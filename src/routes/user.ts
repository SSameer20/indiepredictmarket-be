import { Router } from "express";
import { prisma } from "../db/db";

const router = Router();

// Phase 1: Create or fetch user using wallet address
router.post("/auth", async (req, res): Promise<any> => {
  try {
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: "walletAddress is required" });
    }

    const normalizedAddress = walletAddress.toLowerCase();

    let user = await prisma.user.findUnique({
      where: { walletAddress: normalizedAddress }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress: normalizedAddress,
        }
      });
    }

    res.json({ user });
  } catch (error) {
    console.error("Auth error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
