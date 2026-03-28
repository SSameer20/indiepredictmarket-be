import express from "express";
import { config } from "dotenv";
import userRoutes from "./routes/user";
import marketRoutes from "./routes/market";
import betRoutes from "./routes/bet";
import withdrawRoutes from "./routes/withdraw";
import { startDepositListener } from "./services/depositListener";
import logger from "./lib/logger";

config();
const app = express();

app.use(express.json());

app.use("/api/users", userRoutes);
app.use("/api/markets", marketRoutes);
app.use("/api/bets", betRoutes);
app.use("/api/withdraw", withdrawRoutes);

app.get("/", (_, res) => {
  res.send("IndiePredictMarket Backend running.");
});

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info({ port: PORT }, "Server started");
  startDepositListener();
});
