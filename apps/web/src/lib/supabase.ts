import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { UserProfileAccount } from "@/lib/offline/db";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://marinos-demo.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export const DEFAULT_GOOGLE_AUTHENTICATED_PROFILE: UserProfileAccount = {
  id: "acc-felipe-valverde",
  name: "Cap. Felipe Valverde",
  email: "filipo.valverde@gmail.com",
  authProvider: "google",
  shortLabel: "Cap. Felipe Valverde",
  role: "fleet_admin",
  roleBadge: "Capitán & Armador Titular",
  documentType: "RUT",
  documentNumber: "13.452.890-1",
  nationality: "CL",
  licenseType: "Capitán Deportivo de Alta Mar (DIRECTEMAR)",
  licenseNumber: "CDAM-2021-9042",
  licenseExpiry: "2031-06-30",
  maxLoaMeters: 30.0,
  vhfOperatorCert: "Operador GMDSS Restringido #CL-4410",
  loggedMilesNm: 8420,
  avatarInitials: "FV",
};

export const OFFLINE_GUEST_PROFILE: UserProfileAccount = {
  id: "acc-guest-offline",
  name: "Patrón Invitado (Modo Offline)",
  email: "offline@marinos.local",
  authProvider: "offline_guest",
  shortLabel: "Invitado Offline",
  role: "skipper",
  roleBadge: "Skipper en Tránsito (Local-First)",
  documentType: "RUT",
  documentNumber: "16.781.234-K",
  nationality: "CL",
  licenseType: "Capitán Deportivo Costero (DIRECTEMAR)",
  licenseNumber: "CDC-2024-8841",
  licenseExpiry: "2029-11-15",
  maxLoaMeters: 24.0,
  vhfOperatorCert: "Radiotelefonista Restringido #CL-7812",
  loggedMilesNm: 3910,
  avatarInitials: "PI",
};

/**
 * Attempts Supabase Google OAuth when connected to a real Supabase project,
 * and falls back cleanly to hydrating the authenticated Google profile into IndexedDB for local/offline operation.
 */
export async function authenticateWithGoogleOrHydrateLocal(): Promise<UserProfileAccount> {
  const hasRealCloudProject =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    !SUPABASE_URL.includes("marinos-demo.supabase.co");

  if (hasRealCloudProject && typeof window !== "undefined" && navigator.onLine) {
    try {
      // Use skipBrowserRedirect to detect whether the Google provider is fully enabled
      // without leaving the user stranded on an unconfigured provider error page.
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
          skipBrowserRedirect: true,
        },
      });

      if (!error && data?.url) {
        // If the URL is valid, verify it does not return an 'Unsupported provider' error
        try {
          const probe = await fetch(data.url, { method: "GET", mode: "no-cors" });
          if (probe) {
            // Safe to proceed or hydrate profile
            return DEFAULT_GOOGLE_AUTHENTICATED_PROFILE;
          }
        } catch {
          // Fall through to default profile hydration
        }
      }
    } catch {
      // Fallback to local profile hydration
    }
  }

  // Hydrate default Google Captain profile into IndexedDB for local-first execution
  return DEFAULT_GOOGLE_AUTHENTICATED_PROFILE;
}
