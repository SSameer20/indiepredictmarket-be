import { ethers } from "ethers";
import { prisma } from "../db/db";

// Use an ABI strictly for Transfer events of ERC20 to simplify parsing
const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

export async function startDepositListener() {
  const rpcUrl = process.env.POLYGON_RPC_URL;
  const adminWallet = process.env.ADMIN_WALLET_ADDRESS;
  const usdcAddress = process.env.USDC_CONTRACT_ADDRESS;

  if (!rpcUrl || !adminWallet || !usdcAddress) {
    console.error("Missing env vars for deposit listener. Skipping listener start.");
    return;
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const usdcContract = new ethers.Contract(usdcAddress, ERC20_ABI, provider);

  console.log(`Starting deposit listener for USDC on Polygon...`);
  console.log(`Admin wallet: ${adminWallet}`);
  console.log(`USDC Contract: ${usdcAddress}`);

  // Listen for Transfer events where `to` is the admin wallet
  const filter = usdcContract.filters.Transfer(null, adminWallet);

  usdcContract.on(filter, async (from, to, value, event) => {
    try {
      if (!event.log) {
        console.warn("Event emitted but log is missing.");
        return;
      }
      const txHash = event.log.transactionHash;
      
      console.log(`Pending deposit detected! tx: ${txHash}. Waiting for 2 confirmations...`);

      // Wait for at least 2 confirmations
      const receipt = await provider.waitForTransaction(txHash, 2);
      
      if (receipt && receipt.status === 1) { // 1 means EVM execution succeeded
        // We will parse value based on USDC decimals (6 on Polygon)
        const amount = parseFloat(ethers.formatUnits(value, 6));
        console.log(`Deposit confirmed (2 blocks)! from: ${from}, amount: ${amount} USDC, txHash: ${txHash}`);

        // Process the deposit atomically
        await handleDeposit(from, amount, txHash);
      } else {
         console.warn(`Transaction failed on chain or receipt missing, ignoring. txHash: ${txHash}`);
      }
    } catch (error) {
      console.error("Error processing deposit event:", error);
    }
  });
}

async function handleDeposit(from: string, amount: number, txHash: string) {
  // Balance Update Atomicity
  // We use Prisma $transaction to ensure the update and tx log check is atomic
  try {
    const normalizedAddress = from.toLowerCase();

    await prisma.$transaction(async (tx: any) => {
      // 1. Duplicate guard check
      const existingTx = await tx.transaction.findUnique({
        where: { txHash }
      });

      if (existingTx) {
        console.log(`Transaction ${txHash} already processed. Skipping.`);
        return; // already processed
      }

      // 2. Fetch or create user securely.
      // If the user hasn't connected their wallet before, we still create it to store their balance safely.
      let user = await tx.user.findUnique({
        where: { walletAddress: normalizedAddress }
      });

      if (user) {
        user = await tx.user.update({
          where: { walletAddress: normalizedAddress },
          data: {
            balance: { increment: amount }
          }
        });
      } else {
        user = await tx.user.create({
          data: {
            walletAddress: normalizedAddress,
            balance: amount
          }
        });
      }

      // 3. Create transaction record to prevent replays
      await tx.transaction.create({
        data: {
          userId: user.id,
          txHash,
          type: "DEPOSIT",
          amount,
          status: "CONFIRMED"
        }
      });

      console.log(`Successfully credited ${amount} USDC to ${normalizedAddress}. New Balance: ${user.balance}`);
    });
  } catch (error) {
    console.error(`Failed atomic deposit tx for hash ${txHash}:`, error);
    throw error;
  }
}
