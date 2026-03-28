import { z } from "zod";

// Auth
export const authSchema = z.object({
  walletAddress: z.string().min(10, "Invalid wallet address")
});

// Place Bet
export const betSchema = z.object({
  userId:   z.string().uuid("userId must be a valid UUID"),
  marketId: z.string().uuid("marketId must be a valid UUID"),
  amount:   z.number().positive("amount must be positive"),
  side:     z.enum(["YES", "NO"], { message: 'side must be "YES" or "NO"' })
});

// Create Market (admin)
export const marketSchema = z.object({
  title:   z.string().min(3, "title must be at least 3 characters"),
  endTime: z.string().datetime({ message: "endTime must be a valid ISO 8601 datetime" })
});

// Withdraw
export const withdrawSchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID"),
  amount: z.number().positive("amount must be positive")
});
