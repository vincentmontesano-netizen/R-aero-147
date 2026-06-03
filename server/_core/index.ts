import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerWebhooks } from "../webhooks";
import { loadSettingsIntoEnv } from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Security gate: in production a strong JWT_SECRET is mandatory. An empty/weak secret
  // makes session tokens forgeable (auth bypass), so refuse to boot.
  if (process.env.NODE_ENV === "production" && (process.env.JWT_SECRET ?? "").trim().length < 32) {
    throw new Error("[security] JWT_SECRET must be set to a strong random value (>= 32 chars) in production. Generate one with: openssl rand -hex 32");
  }
  // Load admin-configured settings (e.g. AI API keys) into process.env before serving.
  await loadSettingsIntoEnv().catch((e) => console.warn("[settings] load failed:", e?.message));
  const app = express();
  // Behind Hostinger's reverse proxy (TLS terminated upstream): trust X-Forwarded-* so
  // secure cookies and req.protocol are detected correctly over HTTPS.
  app.set("trust proxy", true);
  const server = createServer(app);
  // Register Stripe webhooks BEFORE express.json() (raw body required)
  registerWebhooks(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
