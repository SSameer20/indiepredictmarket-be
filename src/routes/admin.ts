import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../db/db";
import logger from "../lib/logger";

const router = Router();

// Admin auth middleware (reused from market.ts pattern)
const adminAuth = (req: Request, res: Response, next: NextFunction): any => {
  if (req.headers["x-admin-secret"] !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// Apply to all admin routes
router.use(adminAuth);

// GET /api/admin/overview — high-level stats
router.get("/overview", async (_req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      totalMarkets,
      totalBets,
      openMarkets,
      resolvedMarkets,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.market.count(),
      prisma.bet.count(),
      prisma.market.count({ where: { resolved: false } }),
      prisma.market.count({ where: { resolved: true } }),
    ]);

    // Sum of all user balances
    const balanceAgg = await prisma.user.aggregate({ _sum: { balance: true } });
    const totalBalanceHeld = balanceAgg._sum.balance ?? 0;

    // Deposit/Withdraw totals
    const depositAgg = await prisma.transaction.aggregate({
      where: { type: "DEPOSIT", status: "CONFIRMED" },
      _sum: { amount: true },
    });
    const withdrawAgg = await prisma.transaction.aggregate({
      where: { type: "WITHDRAW", status: "CONFIRMED" },
      _sum: { amount: true },
    });

    res.json({
      users: totalUsers,
      markets: { total: totalMarkets, open: openMarkets, resolved: resolvedMarkets },
      bets: totalBets,
      funds: {
        totalDeposited: depositAgg._sum.amount ?? 0,
        totalWithdrawn: withdrawAgg._sum.amount ?? 0,
        currentlyHeld: totalBalanceHeld,
      },
    });
  } catch (error) {
    logger.error({ error }, "Admin overview error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/users — all users with balances
router.get("/users", async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page ?? "1"), 10);
    const limit = parseInt(String(req.query.limit ?? "20"), 10);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { balance: "desc" },
        include: { _count: { select: { bets: true, transactions: true } } },
      }),
      prisma.user.count(),
    ]);

    res.json({ users, total, page, limit });
  } catch (error) {
    logger.error({ error }, "Admin users error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/transactions — all transactions
router.get("/transactions", async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page ?? "1"), 10);
    const limit = parseInt(String(req.query.limit ?? "20"), 10);
    const type = req.query.type as string | undefined; // "DEPOSIT" | "WITHDRAW"
    const skip = (page - 1) * limit;

    const where = type ? { type } : {};

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { walletAddress: true } } },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({ transactions, total, page, limit });
  } catch (error) {
    logger.error({ error }, "Admin transactions error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/markets — all markets with pool sizes
router.get("/markets", async (_req: Request, res: Response) => {
  try {
    const markets = await prisma.market.findMany({
      orderBy: { endTime: "asc" },
      include: { _count: { select: { bets: true } } },
    });

    // Aggregate pool per market
    const enriched = await Promise.all(
      markets.map(async (m) => {
        const poolAgg = await prisma.bet.groupBy({
          by: ["side"],
          where: { marketId: m.id },
          _sum: { amount: true },
          _count: true,
        });

        const pool: Record<string, { total: number; count: number }> = {};
        for (const row of poolAgg) {
          pool[row.side] = {
            total: row._sum.amount ?? 0,
            count: row._count,
          };
        }

        return { ...m, pool };
      })
    );

    res.json({ markets: enriched });
  } catch (error) {
    logger.error({ error }, "Admin markets error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/markets/:id/resolve — resolve market (also Phase 3)
router.post("/markets/:id/resolve", async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { outcome } = req.body;

    if (typeof outcome !== "boolean") {
      return res.status(400).json({ error: "outcome must be a boolean (true = YES wins, false = NO wins)" });
    }

    // Idempotent guard — prevent double resolution
    const market = await prisma.market.findUnique({ where: { id: String(id) } });
    if (!market) return res.status(404).json({ error: "Market not found" });
    if (market.resolved) return res.status(400).json({ error: "Market already resolved" });

    const winningSide = outcome ? "YES" : "NO";
    const losingSide = outcome ? "NO" : "YES";

    // Fetch all bets
    const allBets = await prisma.bet.findMany({ where: { marketId: String(id) } });
    const winnerBets = allBets.filter((b) => b.side === winningSide);
    const totalWinPool = winnerBets.reduce((s, b) => s + b.amount, 0);
    const totalLosePool = allBets
      .filter((b) => b.side === losingSide)
      .reduce((s, b) => s + b.amount, 0);

    // Payout Engine — proportional distribution of loser pool to winners
    await prisma.$transaction(async (tx: any) => {
      // Mark market resolved first (idempotent protection)
      await tx.market.update({
        where: { id },
        data: { resolved: true, outcome },
      });

      // Refund + payout each winner
      for (const bet of winnerBets) {
        // Proportional share of loser pool
        const share = totalWinPool > 0 ? (bet.amount / totalWinPool) * totalLosePool : 0;
        const payout = bet.amount + share;

        await tx.user.update({
          where: { id: bet.userId },
          data: { balance: { increment: payout } },
        });
      }
    });

    logger.info({ marketId: id, outcome, winningSide, totalWinPool, totalLosePool }, "Market resolved and payouts distributed");

    res.json({
      message: `Market resolved. ${winningSide} wins.`,
      marketId: id,
      outcome,
      winnersCount: winnerBets.length,
      totalWinPool,
      totalLosePool,
    });
  } catch (error) {
    logger.error({ error }, "Market resolution error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/markets/:id resolve — seed IPL markets
router.post("/markets/seed", async (_req: Request, res: Response) => {
  try {
    const iplMarkets = [
      { title: "CSK vs MI — Will CSK win?", hoursFromNow: 24 },
      { title: "RCB vs PBKS — Will Virat Kohli score > 50?", hoursFromNow: 48 },
      { title: "SRH vs GT — Will total sixes be > 15?", hoursFromNow: 72 },
      { title: "KKR vs LSG — Will KKR win by > 20 runs?", hoursFromNow: 96 },
      { title: "DC vs RR — Will there be a super over?", hoursFromNow: 120 },
    ];

    const created = await Promise.all(
      iplMarkets.map((m) => {
        const endTime = new Date();
        endTime.setHours(endTime.getHours() + m.hoursFromNow);
        return prisma.market.create({ data: { title: m.title, endTime } });
      })
    );

    logger.info({ count: created.length }, "IPL markets seeded");
    res.json({ message: `${created.length} IPL markets created`, markets: created });
  } catch (error) {
    logger.error({ error }, "IPL market seed error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
