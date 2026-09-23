import { preventApiCaching } from "./apiCache";
import { processPendingAiVideos } from "../aiVideoJobs";
import "dotenv/config";
import { trustedProxies } from "./proxy";
import { registerHealthRoutes } from "./health";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerWebhooks } from "../webhooks";
import { finalizeExpiredExams, loadSettingsIntoEnv } from "../db";
import { securityHeaders } from "./securityHeaders";

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
  const proxies = trustedProxies();
  // Security gate: in production a strong JWT_SECRET is mandatory. An empty/weak secret
  // makes session tokens forgeable (auth bypass), so refuse to boot.
  if (process.env.NODE_ENV === "production" && (process.env.JWT_SECRET ?? "").trim().length < 32) {
    throw new Error("[security] JWT_SECRET must be set to a strong random value (>= 32 chars) in production. Generate one with: openssl rand -hex 32");
  }
  // Load admin-configured settings (e.g. AI API keys) into process.env before serving.
  await loadSettingsIntoEnv().catch((e) => console.warn("[settings] load failed:", e?.message));
  let finalizingExams = false;
  const finalizeExams = async () => {
    if (finalizingExams) return;
    finalizingExams = true;
    try { const result = await finalizeExpiredExams(); if (result.failed) console.warn(`[exams] ${result.failed} expired sessions require review`); } catch { console.error("[exams] Expiry processing unavailable"); }
    finally { finalizingExams = false; }
  };
  void finalizeExams();
  setInterval(finalizeExams, 30000).unref();
  let collectingVideos=false;
  const collectVideos=async()=>{
    if(collectingVideos)return;collectingVideos=true;
    try{const result=await processPendingAiVideos();if(result.failed)console.warn(`[video] ${result.failed} pending videos could not be collected`);}catch{console.error("[video] Collection unavailable");}
    finally{collectingVideos=false;}
  };
  void collectVideos();
  setInterval(collectVideos,30000).unref();
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", proxies);
  app.use(securityHeaders);
  const server = createServer(app);
  registerHealthRoutes(app);
  // Register Stripe webhooks BEFORE express.json() (raw body required)
  registerWebhooks(app);
  app.use("/api/trpc", preventApiCaching);
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

startServer().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
