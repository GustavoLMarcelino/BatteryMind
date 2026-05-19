import cors from "cors";
import express from "express";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { routes } from "./routes/index.js";

const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

export const app = express();

app.use(
  cors({
    origin: frontendUrl
  })
);
app.use(express.json());
app.use("/api", routes);
app.use(errorMiddleware);
