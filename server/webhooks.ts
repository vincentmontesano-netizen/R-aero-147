import type { Express, Request, Response } from "express";
import express from "express";
import { handleStripeWebhook } from "./stripe";

export function registerWebhooks(app: Express): void {
  // Stripe webhook — must use raw body, registered BEFORE express.json()
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const sig = req.headers["stripe-signature"] as string;

      if (!sig) {
        console.warn("[Webhook] Missing stripe-signature header");
        return res.status(400).json({ error: "Missing signature" });
      }

      try {
        await handleStripeWebhook(req.body as Buffer, sig);
        res.json({ received: true });
      } catch (err: any) {
        console.error("[Webhook] Error:", err.message);
        res.status(400).json({ error: err.message });
      }
    }
  );
}
