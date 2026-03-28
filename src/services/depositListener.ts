import { ethers } from "ethers";
import { prisma } from "../db/db";
import logger from "../lib/logger";

const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

export async function startDepositListener() {
  const rpcUrl = process.env.POLYGON_RPC_URL;
  const adminWallet = process.env.ADMIN_WALLET_ADDRESS;
  const usdcAddress = process.env.USDC_CONTRACT_ADDRESS;

  if (!rpcUrl || !adminWallet || !usdcAddress) {
    logger.warn("Missing POLYGON_RPC_URL, ADMIN_WALLET_ADDRESS, or USDC_CONTRACT_ADDRESS — deposit listener not started");
    return;
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const usdcContract = new ethers.Contract(usdcAddress, ERC20_ABI, provider);
  const filter = usdcContract.filters.Transfer(null, adminWallet);

  logger.info({ adminWallet, usdcAddress }, "Deposit listener started");

  usdcContract.on(filter, async (from, _to, value, event) => {
    const txHash: string = event.log?.transactionHash;
    if (!txHash) return;

    logger.info({ from, txHash }, "Deposit detected — waiting 2 confirmations");

    try {
      const receipt = await provider.waitForTransaction(txHash, 2);

      if (receipt && receipt.status === 1) {
        // USDC has 6 decimals on Polygon
        const amount = parseFloat(ethers.formatUnits(value, 6));
        logger.info({ from, txHash, amount }, "Deposit confirmed (2 blocks)");
        await handleDeposit(from, amount, txHash);
      } else {
        logger.warn({ txHash }, "Deposit tx failed on-chain — ignoring");
      }
    } catch (error) {
      logger.error({ txHash, error }, "Error processing deposit event");
    }
  });
}

async function handleDeposit(from: string, amount: number, txHash: string) {
  const normalizedAddress = from.toLowerCase();

  try {
    await prisma.$transaction(async (tx: any) => {
      // Duplicate Transaction Protection
      const existingTx = await tx.transaction.findUnique({ where: { txHash } });
      if (existingTx) {
        logger.warn({ txHash }, "Duplicate deposit txHash — skipping");
        return;
      }

      let user = await tx.user.findUnique({ where: { walletAddress: normalizedAddress } });

      if (user) {
        user = await tx.user.update({
          where: { walletAddress: normalizedAddress },
          data: { balance: { increment: amount } }
        });
      } else {
        user = await tx.user.create({
          data: { walletAddress: normalizedAddress, balance: amount }
        });
      }

      await tx.transaction.create({
        data: {
          userId: user.id,
          txHash,
          type: "DEPOSIT",
          amount,
          status: "CONFIRMED"
        }
      });

      logger.info({ walletAddress: normalizedAddress, amount, newBalance: user.balance }, "Balance credited");
    });
  } catch (error) {
    logger.error({ txHash, error }, "Atomic deposit transaction failed");
    throw error;
  }
}
