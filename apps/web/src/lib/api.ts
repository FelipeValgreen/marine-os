/**
 * Marine OS — Unified API URL Resolver
 * Resolves the base URL for FastAPI backend endpoints:
 * - If NEXT_PUBLIC_API_URL is explicitly set, uses it (even if empty string for relative paths).
 * - On client-side in production (non-localhost), defaults to "" (same-origin relative path)
 *   which routes through Vercel rewrites to the marine-os-api service.
 * - In local development, defaults to "http://localhost:8000".
 */
export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL !== undefined) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (typeof window !== "undefined") {
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname.endsWith(".local");
    if (!isLocalhost) {
      return "";
    }
  }

  return "http://localhost:8000";
}
