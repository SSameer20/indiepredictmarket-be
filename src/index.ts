import express from "express";
import { config } from "dotenv";
import userRoutes from "./routes/user";
import marketRoutes from "./routes/market";
import betRoutes from "./routes/bet";
import { startDepositListener } from "./services/depositListener";

config();
const app = express();

app.use(express.json());

app.use("/api/users", userRoutes);
app.use("/api/markets", marketRoutes);
app.use("/api/bets", betRoutes);

app.get("/", (_, res) => {
  res.send("IndiePredictMarket Backend running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  // Start the background listener for deposits
  startDepositListener();
});
