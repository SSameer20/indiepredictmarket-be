import { Router, Request, Response } from "express";
import { prisma } from "../db/db";
import { betSchema } from "../lib/schemas";
import logger from "../lib/logger";

const router = Router();

// POST /api/bets — place a bet
router.post("/", async (req: Request, res: Response): Promise<any> => {
  const parse = betSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.issues[0].message });
  }

  const { userId, marketId, amount, side } = parse.data;

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("User not found");
      if (user.balance < amount) throw new Error("Insufficient balance");

      const market = await tx.market.findUnique({ where: { id: marketId } });
      if (!market) throw new Error("Market not found");
      if (market.resolved) throw new Error("Market is already resolved");
      if (new Date() > new Date(market.endTime)) throw new Error("Market betting has ended");

      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: amount } }
      });

      const bet = await tx.bet.create({
        data: { userId, marketId, amount, side }
      });

      return { bet, newBalance: user.balance - amount };
    });

    logger.info({ userId, marketId, amount, side }, "Bet placed");
    res.json(result);
  } catch (error: any) {
    const knownErrors = [
      "User not found",
      "Insufficient balance",
      "Market not found",
      "Market is already resolved",
      "Market betting has ended"
    ];
    if (knownErrors.includes(error.message)) {
      logger.warn({ userId, error: error.message }, "Bet rejection");
      return res.status(400).json({ error: error.message });
    }
    logger.error({ error }, "Bet placement error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/bets/user/:userId — user's bets
router.get("/user/:userId", async (req: Request, res: Response): Promise<any> => {
  try {
    const bets = await prisma.bet.findMany({
      where: { userId: String(req.params.userId) },
      include: { market: true },
      orderBy: { id: "desc" }
    });
    res.json({ bets });
  } catch (error) {
    logger.error({ error }, "Error fetching bets");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
