"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
const port = Number(process.env.PORT) || 3000;
app.use(express_1.default.json());
app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
});
app.get("/", (_req, res) => {
    res.status(200).json({
        message: "Backend is running.",
        healthCheck: "/health",
    });
});
app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});
