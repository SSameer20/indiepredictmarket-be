import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../db/db";

const router = Router();

const adminAuth = (req: Request, res: Response, next: NextFunction): any => {
  const secret = req.headers["x-admin-secret"];
  // For MVP / local dev we'll check against process.env.ADMIN_SECRET
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized: admin secret missing or incorrect" });
  }
  next();
};

// Create Market (Admin)
router.post("/", adminAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const { title, endTime } = req.body;

    if (!title || !endTime) {
      return res.status(400).json({ error: "title and endTime are required" });
    }

    const market = await prisma.market.create({
      data: {
        title,
        endTime: new Date(endTime),
      }
    });

    res.json({ market });
  } catch (error) {
    console.error("Error creating market:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Helper to view all markets
router.get("/", async (req: Request, res: Response) => {
  try {
    const markets = await prisma.market.findMany({
      orderBy: { endTime: 'asc' }
    });
    res.json({ markets });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
