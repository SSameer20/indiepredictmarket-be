import { Router, Request, Response } from "express";
import { prisma } from "../db/db";

const router = Router();

// Place Bet API
// Normally would use auth middleware, but we'll accept userId in body for MVP simplicity
router.post("/", async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, marketId, amount, side } = req.body;

    if (!userId || !marketId || !amount || !side) {
      return res.status(400).json({ error: "userId, marketId, amount, side are required" });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: "Bet amount must be positive" });
    }

    if (side !== "YES" && side !== "NO") {
      return res.status(400).json({ error: "Side must be YES or NO" });
    }

    // Atomic transaction for validations + balance deduct + bet creation
    const result = await prisma.$transaction(async (tx: any) => {
      // Validate User and their balance
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new Error("User not found");
      }
      if (user.balance < amount) {
        throw new Error("Insufficient balance");
      }

      // Bet Validation Guards
      // 1) Validate market exists
      const market = await tx.market.findUnique({ where: { id: marketId } });
      if (!market) {
        throw new Error("Market not found");
      }

      // 2) Prevent betting on resolved markets
      if (market.resolved) {
        throw new Error("Market is already resolved");
      }

      // 3) Prevent betting after endTime
      if (new Date() > new Date(market.endTime)) {
        throw new Error("Market betting has ended");
      }

      // Deduct balance
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: { decrement: amount }
        }
      });

      // Create Bet entry
      const bet = await tx.bet.create({
        data: {
          userId,
          marketId,
          amount,
          side
        }
      });

      return { bet, newBalance: user.balance - amount };
    });

    res.json(result);
  } catch (error: any) {
    console.error("Bet placement error:", error);
    // If it's a validation error we threw manually
    if (error.message && [
      "User not found", 
      "Insufficient balance", 
      "Market not found", 
      "Market is already resolved", 
      "Market betting has ended"
    ].includes(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: "Internal server error during bet processing" });
  }
});

// Helper to view user bets
router.get("/user/:userId", async (req: Request, res: Response): Promise<any> => {
  try {
    const bets = await prisma.bet.findMany({
      where: { userId: String(req.params.userId) },
      include: { market: true },
      orderBy: { id: "desc" }
    });
    res.json({ bets });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
