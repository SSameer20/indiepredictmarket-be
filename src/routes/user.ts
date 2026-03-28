import { Router, Request, Response } from "express";
import { prisma } from "../db/db";
import { authSchema } from "../lib/schemas";
import logger from "../lib/logger";

const router = Router();

// POST /api/users/auth — create or fetch user by wallet address
router.post("/auth", async (req: Request, res: Response): Promise<any> => {
  const parse = authSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.issues[0].message });
  }

  const { walletAddress } = parse.data;
  const normalizedAddress = walletAddress.toLowerCase();

  try {
    let user = await prisma.user.findUnique({ where: { walletAddress: normalizedAddress } });

    if (!user) {
      user = await prisma.user.create({ data: { walletAddress: normalizedAddress } });
      logger.info({ walletAddress: normalizedAddress }, "New user created");
    } else {
      logger.info({ walletAddress: normalizedAddress }, "User authenticated");
    }

    res.json({ user });
  } catch (error) {
    logger.error({ error }, "Auth error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
