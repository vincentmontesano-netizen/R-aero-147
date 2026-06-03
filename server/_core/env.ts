export const ENV = {
  // Application identifier embedded in session tokens (generic, not provider-specific).
  appId: process.env.VITE_APP_ID ?? "r-aero-training-academy",
  // Secret used to sign session cookies (JWT).
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
};
