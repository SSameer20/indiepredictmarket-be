import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../db/db";
import { withdrawSchema } from "../lib/schemas";
import { ethers } from "ethers";
import logger from "../lib/logger";

const router = Router();

// Rate limiter: 1 withdrawal per minute per IP
const withdrawRateLimit = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 1,
  keyGenerator: (req) => req.body?.userId ?? req.ip ?? "unknown",
  message: { error: "Too many withdrawal requests. Please wait 1 minute." },
  standardHeaders: true,
  legacyHeaders: false
});

// POST /api/withdraw
router.post("/", withdrawRateLimit, async (req: Request, res: Response): Promise<any> => {
  const parse = withdrawSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.issues[0].message });
  }

  const { userId, amount } = parse.data;

  try {
    // Step 1 — Validate, deduct balane, create PENDING record atomically
    const txRecord = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("User not found");
      if (user.balance < 10) throw new Error("Minimum balance of 10 required to withdraw");
      if (amount > user.balance) throw new Error("Insufficient balance");

      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: amount } }
      });

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

    logger.info({ userId, amount, to: txRecord.walletAddress }, "Withdrawal initiated");

    // Step 2 — Send native MATIC via ethers.js (no contract)
    const privateKey = process.env.PRIVATE_KEY;
    const rpcUrl = process.env.POLYGON_RPC_URL;

    if (!privateKey || !rpcUrl) {
      throw new Error("Missing PRIVATE_KEY or POLYGON_RPC_URL");
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    try {
      const chainTx = await wallet.sendTransaction({
        to: txRecord.walletAddress,
        value: ethers.parseEther(amount.toString())
      });

      // Update PENDING record with real txHash
      await prisma.transaction.update({
        where: { id: txRecord.record.id },
        data: { txHash: chainTx.hash }
      });

      logger.info({ txHash: chainTx.hash, userId, amount }, "On-chain tx submitted, awaiting confirmation");

      const receipt = await chainTx.wait();

      if (receipt && receipt.status === 1) {
        // Step 3 — Mark CONFIRMED
        await prisma.transaction.update({
          where: { id: txRecord.record.id },
          data: { status: "CONFIRMED" }
        });
        logger.info({ txHash: chainTx.hash, userId, amount }, "Withdrawal CONFIRMED");
        return res.json({ message: "Withdrawal successful", txHash: chainTx.hash, amount });
      } else {
        throw new Error("Transaction reverted on-chain");
      }
    } catch (chainError: any) {
      logger.error({ userId, amount, err: chainError.message }, "On-chain withdrawal FAILED — refunding");

      // Step 4 — Failure Recovery: refund balance + mark FAILED atomically
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

      return res.status(500).json({ error: "On-chain transfer failed. Balance has been refunded." });
    }
  } catch (error: any) {
    const knownErrors = [
      "User not found",
      "Minimum balance of 10 required to withdraw",
      "Insufficient balance",
      "Missing PRIVATE_KEY or POLYGON_RPC_URL"
    ];
    if (knownErrors.includes(error.message)) {
      logger.warn({ userId, error: error.message }, "Withdrawal rejected");
      return res.status(400).json({ error: error.message });
    }
    logger.error({ error }, "Withdrawal error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
