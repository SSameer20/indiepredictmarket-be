import express from "express";
import { config } from "dotenv";
config();
const app = express();

app.get("/", (_, res) => {
  res.send("Hello World!");
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
