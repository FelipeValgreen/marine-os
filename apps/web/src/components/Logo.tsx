"use client";

import React from "react";

interface LogoProps {
  collapsed?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * MarinOS Brand Emblem & Wordmark ("The Linear of the Sea")
 * Geometric abstraction combining a tactical nautical compass rose and an albatross wing profile,
 * paired with heavy geometric typography.
 * Uses Lifebuoy Orange (`var(--accent-primary)`) for high-visibility IALA maritime signaling.
 */
export function Logo({
  collapsed = false,
  size = "md",
  className = "",
}: LogoProps) {
  const dimensions =
    size === "sm" ? "w-8 h-8" : size === "lg" ? "w-12 h-12" : "w-10 h-10";

  const textSize =
    size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-lg";

  return (
    <div
      className={`inline-flex items-center gap-2.5 select-none ${className}`}
      aria-label="MarinOS"
    >
      {/* Geometric Compass + Albatross Vector Mark with Lifebuoy Orange Accent */}
      <div
        className={`${dimensions} rounded-xl flex items-center justify-center relative shrink-0 border transition-all duration-200 border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-[0_0_24px_rgba(255,87,34,0.22)]`}
      >
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-3/4 h-3/4"
          aria-hidden="true"
        >
          {/* Outer Tactical Compass Ring */}
          <circle
            cx="20"
            cy="20"
            r="16.5"
            stroke="currentColor"
            strokeOpacity="0.28"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          {/* Cardinal IALA Ticks */}
          <path
            d="M20 2.5V6.5M20 33.5V37.5M2.5 20H6.5M33.5 20H37.5"
            stroke="var(--accent-primary)"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          {/* Geometric Albatross Wings / Compass Needle in Lifebuoy Orange */}
          <path
            d="M6 22.5L20 11L34 22.5L27.5 24.5L20 17.5L12.5 24.5L6 22.5Z"
            fill="var(--accent-primary)"
          />
          {/* True North Spire */}
          <path
            d="M20 6L23.2 15.5H16.8L20 6Z"
            fill="var(--accent-primary)"
          />
          {/* Keel / Rudder Counterweight */}
          <path
            d="M20 33.5L17.2 23.5H22.8L20 33.5Z"
            fill="var(--accent-primary)"
            fillOpacity="0.7"
          />
          {/* Center Gimbal Pivot */}
          <circle
            cx="20"
            cy="20"
            r="2.2"
            fill="var(--bg-primary)"
            stroke="var(--accent-primary)"
            strokeWidth="1.6"
          />
        </svg>
      </div>

      {/* Heavy Wordmark "MarinOS" */}
      {!collapsed && (
        <div className="flex flex-col leading-none">
          <div
            className={`${textSize} font-black tracking-[-0.04em] flex items-center gap-0.5`}
          >
            <span>Marin</span>
            <span className="text-[var(--accent-primary)]">OS</span>
          </div>
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] opacity-65 mt-0.5">
            iala tactical
          </span>
        </div>
      )}
    </div>
  );
}
