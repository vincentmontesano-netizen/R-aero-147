/** Present validation messages without exposing tRPC/Zod's serialized internals. */
export function readableError(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback;
  const value = error as { message?: unknown; data?: { code?: string } };
  if (
    value.data?.code === "INTERNAL_SERVER_ERROR" ||
    typeof value.message !== "string"
  )
    return fallback;
  const message = value.message.trim();
  if (message.startsWith("[") || message.startsWith("{")) {
    try {
      const issues: unknown = JSON.parse(message);
      if (!Array.isArray(issues)) return fallback;
      const labels = issues.flatMap(issue =>
        issue && typeof issue.message === "string" ? [issue.message] : []
      );
      return [...new Set(labels)].slice(0, 3).join("\n") || fallback;
    } catch {
      return fallback;
    }
  }
  return message && message.length <= 600 ? message : fallback;
}
