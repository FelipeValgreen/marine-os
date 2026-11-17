"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface NavigationModeContextValue {
  isAtSeaMode: boolean;
  toggleNavigationMode: () => void;
  setNavigationMode: (mode: boolean) => void;
}

export const NavigationModeContext = createContext<NavigationModeContextValue | undefined>(
  undefined
);

export function NavigationModeProvider({ children }: { children: React.ReactNode }) {
  const [isAtSeaMode, setIsAtSeaMode] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("marinos_navigation_mode");
      if (saved === "at_sea") {
        setIsAtSeaMode(true);
      }
    } catch {
      // LocalStorage unavailable
    }
  }, []);

  const setNavigationMode = (mode: boolean) => {
    setIsAtSeaMode(mode);
    try {
      localStorage.setItem("marinos_navigation_mode", mode ? "at_sea" : "ashore");
    } catch {
      // LocalStorage unavailable
    }
  };

  const toggleNavigationMode = () => {
    setNavigationMode(!isAtSeaMode);
  };

  return (
    <NavigationModeContext.Provider
      value={{
        isAtSeaMode,
        toggleNavigationMode,
        setNavigationMode,
      }}
    >
      {children}
    </NavigationModeContext.Provider>
  );
}

export function useNavigationMode(): NavigationModeContextValue {
  const ctx = useContext(NavigationModeContext);
  if (!ctx) {
    throw new Error("useNavigationMode must be used within NavigationModeProvider");
  }
  return ctx;
}

export const useNavigationModeContext = useNavigationMode;
