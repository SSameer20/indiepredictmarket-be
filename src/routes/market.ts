import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../db/db";
import { marketSchema } from "../lib/schemas";
import logger from "../lib/logger";

const router = Router();

// Admin auth middleware
const adminAuth = (req: Request, res: Response, next: NextFunction): any => {
  if (req.headers["x-admin-secret"] !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// POST /api/markets — create market (admin only)
router.post("/", adminAuth, async (req: Request, res: Response): Promise<any> => {
  const parse = marketSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.issues[0].message });
  }

  const { title, endTime } = parse.data;

  try {
    const market = await prisma.market.create({
      data: { title, endTime: new Date(endTime) }
    });
    logger.info({ marketId: market.id, title }, "Market created");
    res.json({ market });
  } catch (error) {
    logger.error({ error }, "Error creating market");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/markets — list all markets
router.get("/", async (_req: Request, res: Response) => {
  try {
    const markets = await prisma.market.findMany({ orderBy: { endTime: "asc" } });
    res.json({ markets });
  } catch (error) {
    logger.error({ error }, "Error fetching markets");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
