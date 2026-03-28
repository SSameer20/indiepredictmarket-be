import { Router, Request, Response } from "express";
import { prisma } from "../db/db";
import { ethers } from "ethers";

const router = Router();

// POST /api/withdraw
// Sends native MATIC directly from admin wallet to user wallet — no contracts
router.post("/", async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, amount } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ error: "userId and amount are required" });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: "Withdraw amount must be positive" });
    }

    // Step 1 — Validate & atomically deduct balance + create PENDING record
    const txRecord = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("User not found");
      if (user.balance < 10) throw new Error("Minimum balance of 10 required to withdraw");
      if (amount > user.balance) throw new Error("Insufficient balance");

      // Deduct first — prevents race conditions
      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: amount } }
      });

      // Create PENDING transaction record
      const record = await tx.transaction.create({
        data: {
          userId,
          txHash: `pending-${crypto.randomUUID()}`,
          type: "WITHDRAW",
          amount,
          status: "PENDING"
        }
      });

      return { record, walletAddress: user.walletAddress };
    });

    // Step 2 — Send native MATIC via ethers.js (no contract involved)
    const privateKey = process.env.PRIVATE_KEY;
    const rpcUrl = process.env.POLYGON_RPC_URL;

    if (!privateKey || !rpcUrl) {
      throw new Error("Missing PRIVATE_KEY or POLYGON_RPC_URL in environment");
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    try {
      // Send native token (MATIC) directly — pure web2 controlled transfer
      const chainTx = await wallet.sendTransaction({
        to: txRecord.walletAddress,
        value: ethers.parseEther(amount.toString()) // MATIC uses 18 decimals
      });

      // Update the pending record with the real on-chain txHash
      await prisma.transaction.update({
        where: { id: txRecord.record.id },
        data: { txHash: chainTx.hash }
      });

      // Wait for confirmation
      const receipt = await chainTx.wait();

      if (receipt && receipt.status === 1) {
        // Step 3 — Mark CONFIRMED
        await prisma.transaction.update({
          where: { id: txRecord.record.id },
          data: { status: "CONFIRMED" }
        });

        return res.json({
          message: "Withdrawal successful",
          txHash: chainTx.hash,
          amount
        });
      } else {
        throw new Error("Transaction reverted on-chain");
      }
    } catch (chainError: any) {
      console.error("Chain error during withdrawal:", chainError.message);

      // Step 4 — Failure Recovery: refund balance atomically
      await prisma.$transaction(async (tx: any) => {
        await tx.transaction.update({
          where: { id: txRecord.record.id },
          data: { status: "FAILED" }
        });
        await tx.user.update({
          where: { id: userId },
          data: { balance: { increment: amount } }
        });
      });

      return res.status(500).json({
        error: "On-chain transfer failed. Balance has been refunded."
      });
    }
  } catch (error: any) {
    const knownErrors = [
      "User not found",
      "Minimum balance of 10 required to withdraw",
      "Insufficient balance",
      "Missing PRIVATE_KEY or POLYGON_RPC_URL in environment"
    ];
    if (knownErrors.includes(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Withdrawal error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
