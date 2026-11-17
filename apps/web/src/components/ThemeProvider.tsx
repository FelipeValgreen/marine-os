"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Sun,
  Moon,
  Wifi,
  WifiOff,
  ShieldCheck,
  Compass,
  Ship,
  FileCheck2,
  BookOpen,
  Eye,
  CheckCircle2,
  LogOut,
  LifeBuoy,
  AlertOctagon,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  Sliders,
  Anchor,
  MoreHorizontal,
  X,
} from "lucide-react";
import {
  db,
  ensureDemoSeedData,
  flushSyncQueue,
  enqueueOfflineMutation,
  type UserProfileAccount,
} from "@/lib/offline/db";
import { triggerHapticFeedback, triggerAcousticMarineAlarm } from "@/lib/nautical";
import { Logo } from "@/components/Logo";
import { CommandCenter } from "@/components/CommandCenter";
import { SeaTrialsOnboarding } from "@/components/SeaTrialsOnboarding";
import { EmergencySOSModal } from "@/components/EmergencySOSModal";
import {
  supabase,
  DEFAULT_GOOGLE_AUTHENTICATED_PROFILE,
  OFFLINE_GUEST_PROFILE,
  authenticateWithGoogleOrHydrateLocal,
} from "@/lib/supabase";

export type MarineTheme =
  | "midnight-ocean"
  | "daylight-high-contrast"
  | "night-red-shift";
export type MarineRole = "fleet_admin" | "skipper" | "crew";
export type MarineSection =
  | "bridge"
  | "vessel"
  | "voyages"
  | "fleet"
  | "crew"
  | "logbook"
  | "integrations"
  | "handover"
  | "academy";

export interface ToastNotification {
  id: string;
  title: string;
  subtitle?: string;
  tone?: "cyan" | "emerald" | "amber" | "coral";
}

interface ThemeContextValue {
  theme: MarineTheme;
  toggleTheme: () => void;
  setTheme: (theme: MarineTheme) => void;
  role: MarineRole;
  setRole: (role: MarineRole) => void;
  activeAccount: UserProfileAccount;
  isAuthenticated: boolean;
  loginWithGoogle: () => Promise<void>;
  loginAsOfflineGuest: () => Promise<void>;
  logoutSession: () => Promise<void>;
  updatePassportProfile: (
    updates: Partial<UserProfileAccount>
  ) => Promise<void>;
  switchAccountById: (accountId: string) => void;
  activeSection: MarineSection;
  setActiveSection: (section: MarineSection) => void;
  requestedVesselSubView: "digital_twin" | "damage_control" | "service_book" | null;
  clearRequestedVesselSubView: () => void;
  openCommandCenter: () => void;
  openSOS: () => void;
  isOffline: boolean;
  setSimulatedOffline: (offline: boolean) => void;
  dataMode: "SIMULADO" | "EN_VIVO";
  setDataMode: (mode: "SIMULADO" | "EN_VIVO") => void;
  pendingSyncCount: number;
  triggerManualSync: () => Promise<number>;
  isSeeded: boolean;
  pushToast: (toast: Omit<ToastNotification, "id">) => void;
  relaunchSeaTrials: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useMarineContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useMarineContext must be used within ThemeProvider");
  }
  return ctx;
}

const NAV_ITEMS: {
  id: MarineSection;
  label: string;
  shortLabel: string;
  shortcut: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
    {
      id: "bridge",
      label: "Puente • Carta y HUD",
      shortLabel: "Puente",
      shortcut: "⌘1",
      icon: Compass,
    },
    {
      id: "vessel",
      label: "Barco • Sistemas y Averías",
      shortLabel: "Barco",
      shortcut: "⌘2",
      icon: Ship,
    },
    {
      id: "voyages",
      label: "Viajes • Zarpes y Rutas",
      shortLabel: "Viajes",
      shortcut: "⌘3",
      icon: FileCheck2,
    },
    {
      id: "fleet",
      label: "Flota • Gestión de Embarcaciones",
      shortLabel: "Flota",
      shortcut: "⌘4",
      icon: Anchor,
    },
    {
      id: "crew",
      label: "Tripulación • Rol y Guardia",
      shortLabel: "Tripulación",
      shortcut: "⌘5",
      icon: Users,
    },
    {
      id: "logbook",
      label: "Pasaporte y Bitácora",
      shortLabel: "Pasaporte",
      shortcut: "⌘6",
      icon: BookOpen,
    },
    {
      id: "integrations",
      label: "Integraciones • NMEA y Satelital",
      shortLabel: "Integraciones",
      shortcut: "⌘7",
      icon: Sliders,
    },
    {
      id: "handover",
      label: "Entrega y recepción • Sello SHA-256",
      shortLabel: "Entrega",
      shortcut: "⌘8",
      icon: ShieldCheck,
    },
    {
      id: "academy",
      label: "Aprende • Seguridad Marítima",
      shortLabel: "Aprende",
      shortcut: "⌘9",
      icon: LifeBuoy,
    },
  ];

const AUTH_STORAGE_KEY = "marinos-authenticated-profile-id";
const THEME_STORAGE_KEY = "marinos-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<MarineTheme>("midnight-ocean");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(true);
  const [commandCenterOpen, setCommandCenterOpen] = useState<boolean>(false);
  const [requestedVesselSubView, setRequestedVesselSubView] = useState<
    "digital_twin" | "damage_control" | "service_book" | null
  >(null);
  const [activeAccount, setActiveAccount] = useState<UserProfileAccount>(
    DEFAULT_GOOGLE_AUTHENTICATED_PROFILE
  );
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [activeSection, setActiveSectionState] =
    useState<MarineSection>("bridge");
  const [dataMode, setDataMode] = useState<"SIMULADO" | "EN_VIVO">("SIMULADO");
  const [simulatedOffline, setSimulatedOffline] = useState<boolean>(false);
  const [browserOffline, setBrowserOffline] = useState<boolean>(false);
  const [isSeeded, setIsSeeded] = useState<boolean>(false);
  const [forceSeaTrials, setForceSeaTrials] = useState<boolean>(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState<boolean>(false);
  const [sosModalOpen, setSosModalOpen] = useState<boolean>(false);
  const [sosHoldProgress, setSosHoldProgress] = useState<number>(0);
  const [sosHoldHintVisible, setSosHoldHintVisible] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const sosIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sosStartTimeRef = useRef<number | null>(null);

  const pathname = usePathname();
  const router = useRouter();

  const pendingSyncItems = useLiveQuery(
    () => db.sync_queue.where("status").equals("pending").toArray(),
    [],
    []
  );

  const userPreferences = useLiveQuery(
    () => db.user_preferences.get("default"),
    []
  );

  const pushToast = (toast: Omit<ToastNotification, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-2), { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  };

  // Sync query param `?section=` with activeSectionState (supports friendly URL redirects)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sec = params.get("section") as MarineSection | null;
    if (
      sec &&
      [
        "bridge",
        "vessel",
        "gemelo",
        "voyages",
        "fleet",
        "crew",
        "logbook",
        "passport",
        "integrations",
        "handover",
        "inspections",
        "academy",
      ].includes(sec)
    ) {
      if (sec === ("gemelo" as unknown)) setActiveSectionState("vessel");
      else if (sec === ("inspections" as unknown)) setActiveSectionState("handover");
      else if (sec === ("passport" as unknown)) setActiveSectionState("logbook");
      else setActiveSectionState(sec);
    }
  }, [pathname]);

  // Global Cmd+K / Ctrl+K shortcut & Global Haptic Feedback on buttons
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        triggerHapticFeedback(14);
        setCommandCenterOpen((prev) => !prev);
      }
    };

    const handleGlobalPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("button, [role='button']")) {
        triggerHapticFeedback(10);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("pointerdown", handleGlobalPointerDown, {
      passive: true,
    });
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("pointerdown", handleGlobalPointerDown);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initLocalFirstAndAuth() {
      await ensureDemoSeedData();
      if (!mounted) return;
      setIsSeeded(true);

      if (typeof window !== "undefined") {
        const savedProfileId =
          window.localStorage.getItem(AUTH_STORAGE_KEY) ||
          window.localStorage.getItem("marine-os-authenticated-profile-id");
        if (savedProfileId === "logged_out") {
          setIsAuthenticated(false);
          setAuthChecked(true);
          if (pathname === "/") {
            router.push("/login");
          }
          return;
        }

        const profileIdToLoad =
          savedProfileId || DEFAULT_GOOGLE_AUTHENTICATED_PROFILE.id;
        const existingInDb = await db.user_profiles.get(profileIdToLoad);
        if (existingInDb) {
          setActiveAccount(existingInDb);
        } else {
          await db.user_profiles.put(DEFAULT_GOOGLE_AUTHENTICATED_PROFILE);
          setActiveAccount(DEFAULT_GOOGLE_AUTHENTICATED_PROFILE);
        }
        window.localStorage.setItem(AUTH_STORAGE_KEY, profileIdToLoad);
        setIsAuthenticated(true);
        setAuthChecked(true);
      }
    }

    initLocalFirstAndAuth();

    if (typeof window !== "undefined") {
      const savedTheme = (window.localStorage.getItem(THEME_STORAGE_KEY) ||
        window.localStorage.getItem("marine-os-theme")) as MarineTheme | null;
      if (
        savedTheme === "midnight-ocean" ||
        savedTheme === "daylight-high-contrast" ||
        savedTheme === "night-red-shift"
      ) {
        setThemeState(savedTheme);
        document.documentElement.setAttribute("data-theme", savedTheme);
      } else {
        const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
        const initialTheme: MarineTheme = prefersLight ? "daylight-high-contrast" : "midnight-ocean";
        setThemeState(initialTheme);
        document.documentElement.setAttribute("data-theme", initialTheme);
      }

      setBrowserOffline(!navigator.onLine);
      const handleOnline = () => {
        setBrowserOffline(false);
        flushSyncQueue().catch(() => { });
      };
      const handleOffline = () => setBrowserOffline(true);

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            registration.update().catch(() => { });
            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                    installingWorker.postMessage({ type: "SKIP_WAITING" });
                  }
                };
              }
            };
          })
          .catch(() => { });

        let isRefreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (!isRefreshing) {
            isRefreshing = true;
            window.location.reload();
          }
        });
      }

      return () => {
        mounted = false;
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginWithGoogle = async () => {
    const profile = await authenticateWithGoogleOrHydrateLocal();
    await db.user_profiles.put(profile);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTH_STORAGE_KEY, profile.id);
    }
    setActiveAccount(profile);
    setIsAuthenticated(true);
    pushToast({
      title: `Bienvenido a bordo, ${profile.name}`,
      subtitle: "Perfil náutico guardado en el dispositivo",
      tone: "emerald",
    });
    router.push("/");
  };

  const loginAsOfflineGuest = async () => {
    await db.user_profiles.put(OFFLINE_GUEST_PROFILE);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTH_STORAGE_KEY, OFFLINE_GUEST_PROFILE.id);
    }
    setActiveAccount(OFFLINE_GUEST_PROFILE);
    setIsAuthenticated(true);
    pushToast({
      title: "Modo Invitado Offline Activo",
      subtitle: "Operando 100% en modo local a bordo",
      tone: "cyan",
    });
    router.push("/");
  };

  const logoutSession = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore network error when offline
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTH_STORAGE_KEY, "logged_out");
    }
    setIsAuthenticated(false);
    router.push("/login");
  };

  const updatePassportProfile = async (
    updates: Partial<UserProfileAccount>
  ) => {
    const updated: UserProfileAccount = {
      ...activeAccount,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    await db.user_profiles.put(updated);
    await enqueueOfflineMutation({
      table_name: "user_profiles",
      operation: "UPSERT",
      record_id: updated.id,
      payload: updated as unknown as Record<string, unknown>,
    });
    setActiveAccount(updated);
    pushToast({
      title: "Pasaporte Náutico Actualizado",
      subtitle: "Guardado en el teléfono y pendiente de sincronizar",
      tone: "emerald",
    });
  };

  const setTheme = (nextTheme: MarineTheme) => {
    setThemeState(nextTheme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      document.documentElement.setAttribute("data-theme", nextTheme);
    }
  };

  const toggleTheme = () => {
    const order: MarineTheme[] = [
      "midnight-ocean",
      "night-red-shift",
      "daylight-high-contrast",
    ];
    const nextIdx = (order.indexOf(theme) + 1) % order.length;
    const next = order[nextIdx];
    setTheme(next);
    const names: Record<MarineTheme, string> = {
      "midnight-ocean": "Modo Midnight Ocean (#040B16 • IALA Lifebuoy)",
      "night-red-shift": "Modo Night Red-Shift (#000000 + #FF0000 OLED)",
      "daylight-high-contrast": "Modo Daylight High-Contrast (#F0F4F8 Anti-Glare)",
    };
    pushToast({
      title: names[next],
      subtitle: "Ergonomía visual actualizada",
      tone: "cyan",
    });
  };

  const switchAccountById = async (accountId: string) => {
    const found = await db.user_profiles.get(accountId);
    if (found) {
      setActiveAccount(found);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(AUTH_STORAGE_KEY, found.id);
      }
    }
  };

  const setRole = (nextRole: MarineRole) => {
    setActiveAccount((prev) => ({ ...prev, role: nextRole }));
  };

  const setActiveSection = (section: MarineSection) => {
    setActiveSectionState(section);
    if (pathname !== "/") {
      router.push("/");
    }
  };

  const handleNavigateFromCommandCenter = (
    section: MarineSection,
    subTarget?: "digital_twin" | "damage_control"
  ) => {
    if (subTarget) {
      setRequestedVesselSubView(subTarget);
    }
    setActiveSection(section);
  };

  // =========================================================================
  // 3-SECOND LONG-PRESS SOS ZAFARRANCHO HANDLERS
  // =========================================================================
  const activateSOSZafarrancho = () => {
    if (sosIntervalRef.current) {
      clearInterval(sosIntervalRef.current);
      sosIntervalRef.current = null;
    }
    setSosHoldProgress(0);
    setSosHoldHintVisible(false);
    triggerHapticFeedback([60, 40, 120]);
    triggerAcousticMarineAlarm();
    setSosModalOpen(true);
  };

  const handleSOSPointerDown = () => {
    sosStartTimeRef.current = Date.now();
    setSosHoldProgress(5);
    triggerHapticFeedback(25);

    if (sosIntervalRef.current) clearInterval(sosIntervalRef.current);
    sosIntervalRef.current = setInterval(() => {
      if (!sosStartTimeRef.current) return;
      const elapsed = Date.now() - sosStartTimeRef.current;
      const pct = Math.min(100, Math.round((elapsed / 3000) * 100));
      setSosHoldProgress(pct);
      if (pct === 33 || pct === 66) {
        triggerHapticFeedback(30);
      }
      if (elapsed >= 3000) {
        activateSOSZafarrancho();
      }
    }, 60);
  };

  const handleSOSPointerUpOrLeave = () => {
    if (sosIntervalRef.current) {
      clearInterval(sosIntervalRef.current);
      sosIntervalRef.current = null;
    }
    const elapsed = sosStartTimeRef.current
      ? Date.now() - sosStartTimeRef.current
      : 0;
    sosStartTimeRef.current = null;
    setSosHoldProgress(0);

    // If short tap (< 3000ms), show tactical long-press helper with 1-tap override
    if (elapsed > 0 && elapsed < 3000 && !sosModalOpen) {
      setSosHoldHintVisible(true);
    }
  };

  const isOffline = simulatedOffline || browserOffline;

  const triggerManualSync = async () => {
    if (isOffline) return 0;
    const count = await flushSyncQueue();
    if (count > 0) {
      pushToast({
        title: `Sincronización Completada (${count} registros)`,
        subtitle: "Datos guardados sincronizados con el servidor",
        tone: "emerald",
      });
    }
    return count;
  };

  const isNight = theme === "night-red-shift";
  const isDaylight = theme === "daylight-high-contrast";
  const isLoginRoute = pathname === "/login";
  const isBridgeFullscreen = pathname === "/" && activeSection === "bridge";
  const showSeaTrialsModal =
    !isLoginRoute &&
    (forceSeaTrials ||
      (userPreferences !== undefined &&
        userPreferences.has_completed_onboarding === false));

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        role: activeAccount.role,
        setRole,
        activeAccount,
        isAuthenticated,
        loginWithGoogle,
        loginAsOfflineGuest,
        logoutSession,
        updatePassportProfile,
        switchAccountById,
        activeSection,
        setActiveSection,
        requestedVesselSubView,
        clearRequestedVesselSubView: () => setRequestedVesselSubView(null),
        openCommandCenter: () => setCommandCenterOpen(true),
        openSOS: activateSOSZafarrancho,
        isOffline,
        setSimulatedOffline,
        dataMode,
        setDataMode,
        pendingSyncCount: pendingSyncItems.length,
        triggerManualSync,
        isSeeded: isSeeded && authChecked,
        pushToast,
        relaunchSeaTrials: () => setForceSeaTrials(true),
      }}
    >
      {showSeaTrialsModal && (
        <SeaTrialsOnboarding onComplete={() => setForceSeaTrials(false)} />
      )}
      {sosModalOpen && (
        <EmergencySOSModal onClose={() => setSosModalOpen(false)} />
      )}
      <CommandCenter
        isOpen={commandCenterOpen}
        onClose={() => setCommandCenterOpen(false)}
        onNavigateSection={handleNavigateFromCommandCenter}
        onSetTheme={setTheme}
        onOpenSOS={activateSOSZafarrancho}
        activeAuthorName={activeAccount.name}
        pushToast={pushToast}
      />

      <div
        className={`min-h-screen relative selection:bg-[var(--accent-primary)]/25 ${isNight
          ? "bg-black text-[#FF0000]"
          : isDaylight
            ? "bg-[#F0F4F8] text-[#0A192F]"
            : "bg-[#040B16] text-slate-100"
          }`}
      >
        {/* ===================================================================
            COLLAPSIBLE LINEAR-STYLE DESKTOP SIDEBAR (w-16 collapsed / w-60 expanded)
        =================================================================== */}
        {!isLoginRoute && (
          <aside
            aria-label="MarinOS Navigation Rail"
            className={`hidden lg:flex fixed top-0 left-0 bottom-0 z-50 flex-col justify-between py-3.5 border-r transition-all duration-200 ${sidebarCollapsed ? "w-16 items-center" : "w-60 px-3"
              } ${isNight
                ? "bg-black border-[#FF0000]/40 text-[#FF0000]"
                : isDaylight
                  ? "bg-[#F0F4F8]/95 backdrop-blur-2xl border-slate-300 text-[#0A192F] shadow-xl"
                  : "bg-[#040B16]/95 backdrop-blur-2xl border-white/5 text-slate-200"
              }`}
          >
            {/* Top Brand Logo + Collapse Toggle + Cmd+K Trigger */}
            <div className="flex flex-col gap-2 w-full items-center">
              <div
                className={`flex items-center w-full ${sidebarCollapsed ? "justify-center" : "justify-between px-1"
                  }`}
              >
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveSection("bridge")}
                    title="MarinOS — SV Albatros (CB-4582)"
                    className="min-h-14 flex items-center justify-center rounded-xl px-1"
                  >
                    <Logo collapsed={sidebarCollapsed} size="sm" />
                  </button>
                  {!sidebarCollapsed && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border border-[var(--accent-primary)]/40 font-bold">
                      v2.4
                    </span>
                  )}
                </div>

                {!sidebarCollapsed && (
                  <button
                    type="button"
                    data-testid="sidebar-collapse-btn"
                    onClick={() => setSidebarCollapsed(true)}
                    title="Colapsar barra lateral"
                    className="min-h-14 w-10 rounded-xl hover:bg-white/10 flex items-center justify-center opacity-75 hover:opacity-100"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Command Center Trigger (Cmd+K) */}
              <button
                type="button"
                data-testid="open-command-center-btn"
                onClick={() => setCommandCenterOpen(true)}
                title="Command Center (⌘K)"
                className={`min-h-14 rounded-2xl border flex items-center transition ${sidebarCollapsed
                  ? "w-12 justify-center"
                  : "w-full px-3 justify-between text-xs font-mono"
                  } ${isNight
                    ? "bg-black border-[#FF0000]/50 text-[#FF0000]"
                    : isDaylight
                      ? "bg-[#E1E7EE] border-slate-300 text-[#0A192F]"
                      : "bg-white/5 hover:bg-white/10 border-white/15 text-slate-200"
                  }`}
              >
                <span className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                  {!sidebarCollapsed && <span>Buscar / Comando...</span>}
                </span>
                {!sidebarCollapsed && (
                  <kbd className="px-1.5 py-0.5 rounded bg-black/30 text-[10px] font-bold">
                    ⌘K
                  </kbd>
                )}
              </button>
            </div>

            {/* Center 6 Navigation Items */}
            <nav className="flex flex-col gap-1.5 w-full px-1.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isCurrent = pathname === "/" && activeSection === item.id;
                return (
                  <div
                    key={item.id}
                    className="relative group w-full flex justify-center"
                  >
                    <button
                      type="button"
                      data-testid={`nav-${item.id}`}
                      aria-label={item.label}
                      onClick={() => setActiveSection(item.id)}
                      className={`min-h-14 rounded-2xl flex items-center transition-all ${sidebarCollapsed
                        ? "w-12 justify-center"
                        : "w-full px-3 justify-between text-xs font-semibold"
                        } ${isCurrent
                          ? isNight
                            ? "bg-red-950/40 text-red-500 font-bold border-l-2 border-red-500 rounded-r-2xl rounded-l-none"
                            : isDaylight
                              ? "bg-slate-200 text-[#D94A1A] font-bold border-l-2 border-[#D94A1A] rounded-r-2xl rounded-l-none"
                              : "bg-[#1a2332] text-[var(--accent-primary)] font-bold border-l-2 border-[var(--accent-primary)] rounded-r-2xl rounded-l-none"
                          : "hover:bg-white/[0.04] text-slate-400 hover:text-slate-200"
                        }`}
                    >
                      <span className="flex items-center gap-2.5 truncate">
                        <Icon className="w-5 h-5 shrink-0" />
                        {!sidebarCollapsed && (
                          <span className="truncate">{item.shortLabel}</span>
                        )}
                      </span>
                      {!sidebarCollapsed && (
                        <span className="font-mono text-[10px] opacity-65">
                          {item.shortcut}
                        </span>
                      )}
                    </button>

                    {sidebarCollapsed && (
                      <span
                        className={`pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute left-16 top-1/2 -translate-y-1/2 ml-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap z-50 border shadow-xl ${isNight
                          ? "bg-black border-[#FF0000] text-[#FF0000]"
                          : "bg-slate-900/95 backdrop-blur-xl border-white/15 text-white"
                          }`}
                      >
                        {item.label} ({item.shortcut})
                      </span>
                    )}
                  </div>
                );
              })}
            </nav>

            {/* Bottom Controls: Expand Sidebar, Passport Avatar, Offline Sync, Theme & Logout */}
            <div className="flex flex-col items-center gap-1.5 w-full px-1.5">
              {sidebarCollapsed && (
                <button
                  type="button"
                  data-testid="sidebar-expand-btn"
                  onClick={() => setSidebarCollapsed(false)}
                  title="Expandir barra lateral"
                  className="w-11 min-h-14 rounded-2xl border border-[var(--border-subtle)] bg-white/5 hover:bg-white/10 flex items-center justify-center"
                >
                  <PanelLeftOpen className="w-4 h-4 opacity-80" />
                </button>
              )}

              {/* Active Nautical Passport Avatar */}
              <div className="relative group flex justify-center w-full">
                <button
                  type="button"
                  data-testid="rail-account-btn"
                  onClick={() => setActiveSection("logbook")}
                  className={`${sidebarCollapsed ? "w-11 flex-col" : "w-full px-3 flex-row gap-2"
                    } min-h-14 rounded-2xl border border-[var(--border-subtle)] bg-white/5 hover:bg-white/10 font-mono text-xs font-bold flex items-center justify-center`}
                >
                  <span>{activeAccount.avatarInitials}</span>
                  {sidebarCollapsed ? (
                    <span className="text-[9px] opacity-60 uppercase">PASS</span>
                  ) : (
                    <span className="truncate text-[11px]">
                      {activeAccount.name}
                    </span>
                  )}
                </button>
              </div>

              {/* Offline / Edge-Sync Toggle */}
              <div className="relative group flex justify-center w-full">
                <button
                  type="button"
                  data-testid="offline-toggle-btn"
                  onClick={() => {
                    const next = !simulatedOffline;
                    setSimulatedOffline(next);
                    pushToast({
                      title: next
                        ? "Modo Sin Conexión Activado"
                        : "Modo Conectado (Sincronización Activa)",
                      subtitle: next
                        ? "Operaciones guardadas en el teléfono para sincronizar"
                        : "Conectado a Supabase, FastAPI & Open-Meteo",
                      tone: next ? "amber" : "emerald",
                    });
                  }}
                  className={`${sidebarCollapsed
                    ? "w-11 flex-col"
                    : "w-full px-3 flex-row justify-between"
                    } min-h-14 rounded-2xl border flex items-center justify-center transition ${isOffline
                      ? "border-[#FF9F0A]/60 bg-[#FF9F0A]/15 text-[#FF9F0A]"
                      : "border-[var(--border-subtle)] bg-white/5 hover:bg-white/10"
                    }`}
                >
                  {isOffline ? (
                    <WifiOff className="w-4 h-4" />
                  ) : (
                    <Wifi className="w-4 h-4 text-[var(--status-ok)]" />
                  )}
                  <span className="font-mono text-[10px] mt-0.5">
                    {sidebarCollapsed
                      ? pendingSyncItems.length
                      : `SYNC QUEUE: ${pendingSyncItems.length}`}
                  </span>
                </button>
              </div>

              {/* Dual-Theme Extremo Cycle Button */}
              <div className="relative group flex justify-center w-full">
                <button
                  type="button"
                  data-testid="theme-toggle-btn"
                  onClick={toggleTheme}
                  className={`${sidebarCollapsed
                    ? "w-11"
                    : "w-full px-3 justify-between font-mono text-xs"
                    } min-h-14 rounded-2xl border flex items-center justify-center transition ${isNight
                      ? "bg-[#FF0000] text-black border-[#FF0000] font-bold"
                      : "border-[var(--border-subtle)] bg-white/5 hover:bg-white/10"
                    }`}
                >
                  {isNight ? (
                    <Eye className="w-5 h-5" />
                  ) : isDaylight ? (
                    <Sun className="w-5 h-5 text-[#D94A1A]" />
                  ) : (
                    <Moon className="w-5 h-5 text-[var(--accent-primary)]" />
                  )}
                  {!sidebarCollapsed && (
                    <span>
                      {isNight
                        ? "RED-SHIFT"
                        : isDaylight
                          ? "DAYLIGHT"
                          : "MIDNIGHT"}
                    </span>
                  )}
                </button>
              </div>

              {/* Logout / Login Screen Button */}
              <div className="relative group flex justify-center w-full">
                <button
                  type="button"
                  data-testid="rail-logout-btn"
                  onClick={logoutSession}
                  aria-label="Cerrar sesión / Ir a Login"
                  className={`${sidebarCollapsed ? "w-11" : "w-full px-3 gap-2 text-xs font-mono"
                    } min-h-14 rounded-2xl border border-[var(--border-subtle)] bg-white/5 hover:bg-[#FF2D55]/20 hover:border-[#FF2D55]/40 flex items-center justify-center transition`}
                >
                  <LogOut className="w-4 h-4 opacity-75" />
                  {!sidebarCollapsed && <span>Cambiar Cuenta</span>}
                </button>
              </div>
            </div>
          </aside>
        )}

        {/* ===================================================================
            FLOATING TOAST NOTIFICATIONS (Top-Center)
        =================================================================== */}
        {toasts.length > 0 && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 pointer-events-none w-[92vw] max-w-md">
            {toasts.map((t) => (
              <div
                key={t.id}
                className="marine-card px-4 py-3 flex items-center gap-3 border border-[var(--accent-primary)]/40 shadow-2xl"
              >
                <CheckCircle2 className="w-5 h-5 text-[var(--accent-primary)] shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold truncate">
                    {t.title}
                  </div>
                  {t.subtitle && (
                    <div className="text-[11px] font-mono opacity-75 truncate">
                      {t.subtitle}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===================================================================
            PERSISTENT SIMULATION BANNER - R-4.1.2
        =================================================================== */}
        {!isLoginRoute && dataMode === "SIMULADO" && (
          <div
            data-testid="simulation-mode-banner"
            className={`${sidebarCollapsed ? "lg:pl-16" : "lg:pl-60"
              } w-full bg-[#D94A1A] text-white py-1 px-4 text-center font-mono text-[10px] sm:text-[11px] font-bold tracking-wider uppercase shadow-md flex items-center justify-center gap-2 relative z-40 transition-all duration-200`}
          >
            <span>⚠️ MODO SIMULACIÓN — datos ficticios, no usar para navegar</span>
          </div>
        )}

        {/* ===================================================================
            MAIN VIEWPORT CONTAINER
        =================================================================== */}
        <main
          className={
            isLoginRoute || isBridgeFullscreen
              ? "w-screen h-screen overflow-hidden relative"
              : `${sidebarCollapsed ? "lg:pl-16" : "lg:pl-60"
              } min-h-screen pb-24 lg:pb-10 transition-all duration-200`
          }
        >
          {isLoginRoute || isBridgeFullscreen ? (
            children
          ) : (
            <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-6">
              {children}
            </div>
          )}
        </main>

        {/* ===================================================================
            BOTÓN SOS ZAFARRANCHO (3-SECOND LONG-PRESS + DIRECT OVERRIDE)
        =================================================================== */}
        {!isLoginRoute && (
          <div className="fixed bottom-20 lg:bottom-6 right-4 z-[55] flex flex-col items-end gap-2">
            {sosHoldHintVisible && (
              <div
                data-testid="sos-longpress-hint-card"
                className="marine-card p-3.5 border-2 border-[#FF2D55] max-w-xs space-y-2 shadow-2xl"
              >
                <div className="font-mono text-[11px] font-bold text-[#FF2D55]">
                  SEGURIDAD SOLAS: MANTÉN 3 SEGUNDOS PARA ZAFARRANCHO
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="sos-immediate-override-btn"
                    onClick={activateSOSZafarrancho}
                    className="flex-1 min-h-14 px-3 rounded-xl bg-[#FF2D55] text-white font-mono text-xs font-black"
                  >
                    ACTIVAR SOS AHORA
                  </button>
                  <button
                    type="button"
                    onClick={() => setSosHoldHintVisible(false)}
                    className="min-h-14 px-3 rounded-xl bg-white/10 font-mono text-xs"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              data-testid="floating-sos-btn"
              onPointerDown={handleSOSPointerDown}
              onPointerUp={handleSOSPointerUpOrLeave}
              onPointerLeave={handleSOSPointerUpOrLeave}
              onDoubleClick={activateSOSZafarrancho}
              className="relative overflow-hidden min-h-[64px] px-5 rounded-full bg-red-600 hover:bg-red-700 text-white font-mono text-xs sm:text-sm font-bold tracking-wider flex items-center gap-2.5 border border-red-800 shadow-none transition transform active:scale-95 select-none"
            >
              {/* 3-Second Hold Progress Fill Bar */}
              {sosHoldProgress > 0 && (
                <span
                  aria-hidden="true"
                  style={{ width: `${sosHoldProgress}%` }}
                  className="absolute inset-y-0 left-0 bg-white/35 transition-all duration-75"
                />
              )}
              <AlertOctagon className="w-5 h-5 animate-pulse shrink-0 relative z-10" />
              <span className="relative z-10">
                {sosHoldProgress > 0
                  ? `ZAFARRANCHO ${Math.ceil(
                    ((100 - sosHoldProgress) / 100) * 3
                  )}S...`
                  : "SOS • MANTENER 3S"}
              </span>
            </button>
          </div>
        )}

        {/* ===================================================================
            MOBILE "MÁS" MENU SHEET (PRD 5.4)
        =================================================================== */}
        {mobileMoreOpen && (
          <div
            className="lg:hidden fixed inset-0 z-[60] bg-black/70 backdrop-blur-md flex flex-col justify-end"
            onClick={() => setMobileMoreOpen(false)}
          >
            <div
              className={`p-5 rounded-t-3xl border-t space-y-4 max-h-[80vh] overflow-y-auto ${
                isNight
                  ? "bg-black border-[#FF0000]/50 text-[#FF0000]"
                  : isDaylight
                  ? "bg-[#F0F4F8] border-slate-300 text-[#0A192F]"
                  : "bg-[#060b14] border-white/10 text-slate-100"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <div className="font-bold text-sm tracking-wide uppercase opacity-75">
                  Más Módulos y Ajustes
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMoreOpen(false)}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: "crew", label: "Tripulación", icon: Users, desc: "Rol y guardia" },
                  { id: "logbook", label: "Pasaporte", icon: BookOpen, desc: "Bitácora de a bordo" },
                  { id: "integrations", label: "Integraciones", icon: Sliders, desc: "NMEA y satelital" },
                  { id: "handover", label: "Entrega", icon: ShieldCheck, desc: "Acta y sello SHA-256" },
                  { id: "academy", label: "Aprende", icon: LifeBuoy, desc: "Seguridad marítima" },
                ].map((item) => {
                  const Icon = item.icon;
                  const isCurrent = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={`mobile-more-${item.id}`}
                      onClick={() => {
                        setActiveSection(item.id as MarineSection);
                        setMobileMoreOpen(false);
                      }}
                      className={`min-h-[56px] p-3 rounded-2xl border text-left flex items-center gap-3 transition ${
                        isCurrent
                          ? "bg-[var(--accent-primary)]/20 border-[var(--accent-primary)] text-[var(--accent-primary)]"
                          : "bg-white/[0.04] border-white/5 hover:bg-white/[0.08]"
                      }`}
                    >
                      <Icon className="w-5 h-5 shrink-0 text-[var(--accent-primary)]" />
                      <div>
                        <div className="text-xs font-bold">{item.label}</div>
                        <div className="text-[10px] opacity-60">{item.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Quick Action: Toggle Scotopic Night Mode */}
              <button
                type="button"
                onClick={() => {
                  toggleTheme();
                  setMobileMoreOpen(false);
                }}
                className="w-full min-h-[52px] rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center gap-2 text-xs font-bold"
              >
                <Eye className="w-4 h-4 text-red-500" />
                <span>Cambiar Tema (Día / Noche / Sol)</span>
              </button>
            </div>
          </div>
        )}

        {/* ===================================================================
            PERSISTENT TRANSLUCENT MOBILE BOTTOM TAB BAR (5 ITEMS - PRD 5.4)
        =================================================================== */}
        {!isLoginRoute && (
          <nav
            aria-label="Navegación móvil"
            className={`lg:hidden fixed bottom-0 inset-x-0 z-50 border-t flex items-center justify-around px-1 py-1 ${
              isNight
                ? "bg-black border-[#FF0000]/40 text-[#FF0000]"
                : isDaylight
                ? "bg-[#F0F4F8]/95 backdrop-blur-2xl border-slate-300 text-[#0A192F]"
                : "backdrop-blur-2xl bg-[#060b14]/95 border-white/5 text-slate-200"
            }`}
          >
            {[
              { id: "bridge" as MarineSection, shortLabel: "Puente", icon: Compass },
              { id: "vessel" as MarineSection, shortLabel: "Barco", icon: Ship },
              { id: "voyages" as MarineSection, shortLabel: "Viajes", icon: FileCheck2 },
              { id: "fleet" as MarineSection, shortLabel: "Flota", icon: Anchor },
            ].map((item) => {
              const Icon = item.icon;
              const isCurrent = pathname === "/" && activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`mobile-nav-${item.id}`}
                  onClick={() => {
                    setActiveSection(item.id);
                    setMobileMoreOpen(false);
                  }}
                  className={`w-1/5 min-h-[56px] flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition rounded-xl ${
                    isCurrent
                      ? isNight
                        ? "text-red-500 font-bold bg-red-950/30 border-b-2 border-red-500"
                        : isDaylight
                        ? "text-[#D94A1A] font-bold bg-slate-200 border-b-2 border-[#D94A1A]"
                        : "text-[var(--accent-primary)] font-bold bg-[#1a2332] border-b-2 border-[var(--accent-primary)]"
                      : "text-slate-400 opacity-70 hover:opacity-100"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="truncate">{item.shortLabel}</span>
                </button>
              );
            })}

            {/* 5th Item: Más */}
            {(() => {
              const isMoreActive = ["crew", "logbook", "integrations", "handover", "academy"].includes(activeSection);
              return (
                <button
                  type="button"
                  data-testid="mobile-nav-more"
                  onClick={() => setMobileMoreOpen((prev) => !prev)}
                  className={`w-1/5 min-h-[56px] flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition rounded-xl ${
                    isMoreActive || mobileMoreOpen
                      ? isNight
                        ? "text-red-500 font-bold bg-red-950/30 border-b-2 border-red-500"
                        : isDaylight
                        ? "text-[#D94A1A] font-bold bg-slate-200 border-b-2 border-[#D94A1A]"
                        : "text-[var(--accent-primary)] font-bold bg-[#1a2332] border-b-2 border-[var(--accent-primary)]"
                      : "text-slate-400 opacity-70 hover:opacity-100"
                  }`}
                >
                  <MoreHorizontal className="w-5 h-5" />
                  <span className="truncate">Más</span>
                </button>
              );
            })()}
          </nav>
        )}
      </div>
    </ThemeContext.Provider>
  );
}
