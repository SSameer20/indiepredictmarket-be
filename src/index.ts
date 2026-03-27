import express, { Request, Response } from "express";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    message: "Backend is running.",
    healthCheck: "/health",
  });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
