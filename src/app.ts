import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { router } from "./routes/index.js";
import { errorHandler, notFound } from "./middlewares/errorHandler.js";
import { stripeWebhook } from "./controllers/webhook.controller.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Raw body is required to verify Stripe's signature, so this must come BEFORE express.json().
app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhook);

app.use(express.json({ limit: "100kb" }));

app.use("/api", router);
app.use(notFound);
app.use(errorHandler);

export default app;