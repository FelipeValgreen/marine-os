"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Compass,
  Crosshair,
  Navigation,
  ChevronRight,
  Zap,
  Lock,
  Unlock,
} from "lucide-react";
import {
  haversineDistanceMeters,
  calculateBearingDeg,
  type GPXWaypoint,
} from "@/lib/nautical";
import {
  db,
  type AnchorageSpatialRecord,
  type TrackPoint,
  type CommunityReportRecord,
} from "@/lib/offline/db";

export interface NauticalMapProps {
  waypoints: GPXWaypoint[];
  anchorages: AnchorageSpatialRecord[];
  selectedAnchorage: AnchorageSpatialRecord | null;
  vesselPosition: { lat: number; lon: number };
  anchorPosition: { lat: number; lon: number };
  swingRadiusMeters: number;
  isDragging?: boolean;
  isNight: boolean;
  fullScreen?: boolean;
  trackPoints?: TrackPoint[];
  communityReports?: CommunityReportRecord[];
  onSelectAnchorage?: (anchorage: AnchorageSpatialRecord) => void;
  // Live Navigation Props
  vesselCogDeg?: number;
  vesselSogKn?: number;
  followVessel?: boolean;
  onToggleFollowVessel?: (follow: boolean) => void;
  orientationMode?: "north-up" | "course-up";
  onToggleOrientation?: (mode: "north-up" | "course-up") => void;
  activeTargetWaypoint?: GPXWaypoint | null;
  wakeLockActive?: boolean;
  onToggleWakeLock?: () => void;
}

/**
 * Calculates endpoint given start [lat, lon], bearing in degrees, and distance in meters (WGS84 spherical).
 */
function calculateDestination(
  lat: number,
  lon: number,
  bearingDeg: number,
  distMeters: number
): [number, number] {
  const R = 6371000;
  const d = distMeters / R;
  const θ = (bearingDeg * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lon * Math.PI) / 180;

  const sinφ2 =
    Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const y = Math.sin(θ) * Math.sin(d) * Math.cos(φ1);
  const x = Math.cos(d) - Math.sin(φ1) * sinφ2;
  const λ2 = λ1 + Math.atan2(y, x);

  const destLon = (((λ2 * 180) / Math.PI + 540) % 360) - 180;
  const destLat = (φ2 * 180) / Math.PI;
  return [destLon, destLat];
}

/**
 * Generates a geodesic polygon circle around [lon, lat] with given radius in meters.
 */
function createGeoJSONCircle(
  lon: number,
  lat: number,
  radiusMeters: number,
  points = 64
): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  const distanceX = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  const distanceY = radiusMeters / 110574;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([lon + x, lat + y]);
  }
  coords.push(coords[0]);

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [coords],
    },
  };
}

const CARTO_DARK_MATTER_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export function NauticalMap({
  waypoints,
  anchorages,
  selectedAnchorage,
  vesselPosition,
  anchorPosition,
  swingRadiusMeters,
  isDragging = false,
  isNight = false,
  fullScreen = false,
  trackPoints = [],
  communityReports,
  onSelectAnchorage,
  vesselCogDeg = 0,
  vesselSogKn = 0,
  followVessel: controlledFollowVessel,
  onToggleFollowVessel,
  orientationMode: controlledOrientation,
  onToggleOrientation,
  activeTargetWaypoint: controlledTargetWp,
  wakeLockActive = false,
  onToggleWakeLock,
}: NauticalMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [filter24hOnly, setFilter24hOnly] = useState(true);

  // Uncontrolled fallback state
  const [internalFollow, setInternalFollow] = useState(true);
  const [internalOrientation, setInternalOrientation] = useState<
    "north-up" | "course-up"
  >("north-up");
  const [selectedWpIdx, setSelectedWpIdx] = useState<number>(0);
  const [hudCollapsed, setHudCollapsed] = useState(false);

  // P1.2: Touch-Lock (Wet Screen / Rain Protection)
  const [isTouchLocked, setIsTouchLocked] = useState<boolean>(false);
  const [unlockPressStart, setUnlockPressStart] = useState<number | null>(null);
  const [unlockProgressPct, setUnlockProgressPct] = useState<number>(0);
  const unlockTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastHeadingRef = useRef<number>(0);

  const startUnlockHold = useCallback(() => {
    setUnlockPressStart(Date.now());
    const startTime = Date.now();
    unlockTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / 2500) * 100));
      setUnlockProgressPct(pct);
      if (elapsed >= 2500) {
        if (unlockTimerRef.current) clearInterval(unlockTimerRef.current);
        setIsTouchLocked(false);
        setUnlockPressStart(null);
        setUnlockProgressPct(0);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate([100, 50, 150]);
        }
      }
    }, 50);
  }, []);

  const cancelUnlockHold = useCallback(() => {
    if (unlockTimerRef.current) {
      clearInterval(unlockTimerRef.current);
      unlockTimerRef.current = null;
    }
    setUnlockPressStart(null);
    setUnlockProgressPct(0);
  }, []);

  const followVessel =
    controlledFollowVessel !== undefined
      ? controlledFollowVessel
      : internalFollow;
  const orientationMode =
    controlledOrientation !== undefined
      ? controlledOrientation
      : internalOrientation;

  const setFollow = useCallback(
    (val: boolean) => {
      setInternalFollow(val);
      onToggleFollowVessel?.(val);
    },
    [onToggleFollowVessel]
  );

  const setOrientation = useCallback(
    (mode: "north-up" | "course-up") => {
      setInternalOrientation(mode);
      onToggleOrientation?.(mode);
    },
    [onToggleOrientation]
  );

  const vesselPositionRef = useRef(vesselPosition);
  useEffect(() => {
    vesselPositionRef.current = vesselPosition;
  }, [vesselPosition]);

  // Target waypoint calculation
  const activeWp = useMemo(() => {
    if (controlledTargetWp) return controlledTargetWp;
    if (waypoints && waypoints.length > 0) {
      return waypoints[selectedWpIdx] || waypoints[0];
    }
    return null;
  }, [controlledTargetWp, waypoints, selectedWpIdx]);

  // Active Navigation Calculations (DTW, BTW, ETA, Steering Deviation)
  const navStats = useMemo(() => {
    if (!activeWp) return null;
    const distMeters = haversineDistanceMeters(
      vesselPosition.lat,
      vesselPosition.lon,
      activeWp.lat,
      activeWp.lon
    );
    const dtwNm = Math.round((distMeters / 1852) * 10) / 10;
    const btwDeg = calculateBearingDeg(
      vesselPosition.lat,
      vesselPosition.lon,
      activeWp.lat,
      activeWp.lon
    );

    let etaText = "--:--";
    let minutesToWp: number | null = null;
    if (vesselSogKn && vesselSogKn > 0.4) {
      const hours = dtwNm / vesselSogKn;
      minutesToWp = Math.round(hours * 60);
      const now = new Date();
      const arrival = new Date(now.getTime() + minutesToWp * 60 * 1000);
      const hh = String(arrival.getHours()).padStart(2, "0");
      const mm = String(arrival.getMinutes()).padStart(2, "0");
      etaText = `${hh}:${mm} (${minutesToWp < 60 ? `${minutesToWp}m` : `${Math.floor(minutesToWp / 60)}h ${minutesToWp % 60}m`})`;
    }

    // Steering deviation relative to target bearing
    let steerAdvice = "EN RUMBO";
    let steerDelta = 0;
    if (vesselCogDeg !== undefined && vesselSogKn && vesselSogKn > 0.4) {
      steerDelta = ((btwDeg - vesselCogDeg + 540) % 360) - 180;
      if (steerDelta > 2) {
        steerAdvice = `CAER ESTRIBOR +${Math.round(steerDelta)}°`;
      } else if (steerDelta < -2) {
        steerAdvice = `CAER BABOR ${Math.round(steerDelta)}°`;
      }
    }

    return {
      wpName: activeWp.name || `WP #${selectedWpIdx + 1}`,
      dtwNm,
      btwDeg,
      etaText,
      steerAdvice,
      steerDelta,
    };
  }, [activeWp, vesselPosition, vesselSogKn, vesselCogDeg, selectedWpIdx]);

  const liveReports = useLiveQuery(() => db.community_reports.toArray(), [], []);
  const allReports = communityReports || liveReports || [];

  const effectiveReports = useMemo(() => {
    if (!filter24hOnly) return allReports;
    const now = Date.now();
    const ttlMs = 24 * 60 * 60 * 1000;
    return allReports.filter((r) => {
      const age = now - new Date(r.created_at).getTime();
      return age >= 0 && age <= ttlMs;
    });
  }, [allReports, filter24hOnly]);

  // Compute 10-minute course projection vector
  const courseVectorGeoJSON = useMemo(() => {
    if (!vesselSogKn || vesselSogKn < 0.4 || vesselCogDeg === undefined) {
      return {
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "LineString" as const,
          coordinates: [],
        },
      };
    }
    // 10 minutes projection distance in meters
    const vectorDistMeters = (vesselSogKn / 6) * 1852;
    const dest = calculateDestination(
      vesselPosition.lat,
      vesselPosition.lon,
      vesselCogDeg,
      Math.max(300, vectorDistMeters)
    );

    return {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [vesselPosition.lon, vesselPosition.lat],
          [dest[0], dest[1]],
        ],
      },
    };
  }, [vesselPosition, vesselCogDeg, vesselSogKn]);

  const addNauticalOverlays = (map: maplibregl.Map) => {
    if (!map.getSource("openseamap-seamarks")) {
      map.addSource("openseamap-seamarks", {
        type: "raster",
        tiles: ["https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenSeaMap contributors",
      });
      map.addLayer({
        id: "openseamap-seamarks-layer",
        type: "raster",
        source: "openseamap-seamarks",
        paint: {
          "raster-opacity": 0.92,
        },
      });
    }

    if (!map.getSource("gpx-route")) {
      map.addSource("gpx-route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: waypoints.map((wp) => [wp.lon, wp.lat]),
          },
        },
      });

      map.addLayer({
        id: "gpx-route-glow",
        type: "line",
        source: "gpx-route",
        paint: {
          "line-color": "#00E5FF",
          "line-width": 8,
          "line-opacity": 0.2,
          "line-blur": 4,
        },
      });

      map.addLayer({
        id: "gpx-route-line",
        type: "line",
        source: "gpx-route",
        paint: {
          "line-color": "#00E5FF",
          "line-width": 2.5,
          "line-dasharray": [3, 2],
        },
      });
    }

    if (!map.getSource("recorded-track")) {
      map.addSource("recorded-track", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: trackPoints.map((pt) => [pt.lon, pt.lat]),
          },
        },
      });

      map.addLayer({
        id: "recorded-track-line",
        type: "line",
        source: "recorded-track",
        paint: {
          "line-color": "#00E676",
          "line-width": 3.5,
        },
      });
    }

    if (!map.getSource("gpx-waypoints")) {
      map.addSource("gpx-waypoints", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: waypoints.map((wp, idx) => ({
            type: "Feature" as const,
            properties: { name: wp.name, idx: idx + 1 },
            geometry: {
              type: "Point" as const,
              coordinates: [wp.lon, wp.lat],
            },
          })),
        },
      });

      map.addLayer({
        id: "gpx-waypoints-circle",
        type: "circle",
        source: "gpx-waypoints",
        paint: {
          "circle-radius": 6,
          "circle-color": "#040B16",
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#00E5FF",
        },
      });
    }

    if (!map.getSource("anchorages-source")) {
      map.addSource("anchorages-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: anchorages.map((a) => ({
            type: "Feature" as const,
            properties: {
              slug: a.slug,
              name: a.name,
              min_depth_m: a.min_depth_m,
              seabed_type: a.seabed_type,
            },
            geometry: {
              type: "Point" as const,
              coordinates: [a.lon, a.lat],
            },
          })),
        },
      });

      map.addLayer({
        id: "anchorages-halo",
        type: "circle",
        source: "anchorages-source",
        paint: {
          "circle-radius": 14,
          "circle-color": "#00E676",
          "circle-opacity": 0.22,
        },
      });

      map.addLayer({
        id: "anchorages-layer",
        type: "circle",
        source: "anchorages-source",
        paint: {
          "circle-radius": 7,
          "circle-color": "#00E676",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#040B16",
        },
      });
    }

    if (!map.getSource("community-pins-source")) {
      map.addSource("community-pins-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: effectiveReports.map((r) => ({
            type: "Feature" as const,
            properties: {
              id: r.id,
              author_name: r.author_name,
              vessel_name: r.vessel_name,
              title: r.title,
              content: r.content,
              report_type: r.report_type,
              wind_conditions: r.wind_conditions || "",
              chain_payout_m: r.chain_payout_m || 0,
              seabed_type: r.seabed_type || "",
              upvotes: r.upvotes,
              created_at: r.created_at,
              lat: r.lat,
              lon: r.lon,
            },
            geometry: {
              type: "Point" as const,
              coordinates: [r.lon, r.lat],
            },
          })),
        },
      });

      map.addLayer({
        id: "community-pins-halo",
        type: "circle",
        source: "community-pins-source",
        paint: {
          "circle-radius": 15,
          "circle-color": "#FF5722",
          "circle-opacity": 0.28,
        },
      });

      map.addLayer({
        id: "community-pins-layer",
        type: "circle",
        source: "community-pins-source",
        paint: {
          "circle-radius": 7.5,
          "circle-color": "#FF5722",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#FFFFFF",
        },
      });
    }

    if (!map.getSource("swing-circle")) {
      map.addSource("swing-circle", {
        type: "geojson",
        data: createGeoJSONCircle(
          anchorPosition.lon,
          anchorPosition.lat,
          swingRadiusMeters * 6
        ),
      });

      map.addLayer({
        id: "swing-circle-fill",
        type: "fill",
        source: "swing-circle",
        paint: {
          "fill-color": isDragging ? "#FF2D55" : "#00E676",
          "fill-opacity": 0.14,
        },
      });

      map.addLayer({
        id: "swing-circle-line",
        type: "line",
        source: "swing-circle",
        paint: {
          "line-color": isDragging ? "#FF2D55" : "#00E676",
          "line-width": 1.75,
          "line-dasharray": [2, 2],
        },
      });
    }

    // Dynamic Course Projection Vector (10min predictor)
    if (!map.getSource("course-vector-source")) {
      map.addSource("course-vector-source", {
        type: "geojson",
        data: courseVectorGeoJSON,
      });

      map.addLayer({
        id: "course-vector-line",
        type: "line",
        source: "course-vector-source",
        paint: {
          "line-color": isNight ? "#FF453A" : "#00E5FF",
          "line-width": 2.5,
          "line-dasharray": [4, 2],
        },
      });
    }

    if (!map.getSource("vessel-pos")) {
      map.addSource("vessel-pos", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: { title: "SV Albatros" },
          geometry: {
            type: "Point",
            coordinates: [vesselPosition.lon, vesselPosition.lat],
          },
        },
      });

      map.addLayer({
        id: "vessel-pos-pulse",
        type: "circle",
        source: "vessel-pos",
        paint: {
          "circle-radius": 20,
          "circle-color": isNight ? "#FF1E1E" : "#00E5FF",
          "circle-opacity": 0.25,
        },
      });

      map.addLayer({
        id: "vessel-pos-circle",
        type: "circle",
        source: "vessel-pos",
        paint: {
          "circle-radius": 8,
          "circle-color": isNight ? "#FF1E1E" : "#00E5FF",
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#040B16",
        },
      });
    }
  };

  // Initialize MapLibre GL
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: CARTO_DARK_MATTER_STYLE,
      center: [vesselPosition.lon, vesselPosition.lat],
      zoom: 11.2,
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true }),
      "bottom-right"
    );

    // Disable follow mode when user manually drags or touches the map
    map.on("dragstart", () => {
      setFollow(false);
    });

    map.on("load", () => {
      addNauticalOverlays(map);

      map.on("click", "anchorages-layer", (e) => {
        const feature = e.features?.[0];
        if (!feature || !onSelectAnchorage) return;
        const slug = feature.properties?.slug;
        const found = anchorages.find((a) => a.slug === slug);
        if (found) onSelectAnchorage(found);
      });

      map.on("mouseenter", "community-pins-layer", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "community-pins-layer", () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("click", "community-pins-layer", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const p = feature.properties as Record<string, string | number>;
        const geom = feature.geometry as GeoJSON.Point;
        const coordinates = geom.coordinates.slice() as [number, number];

        const createdAtStr = String(p.created_at || "");
        const createdMs = createdAtStr ? new Date(createdAtStr).getTime() : 0;
        const ageMs = createdMs ? Math.max(0, Date.now() - createdMs) : 0;
        const ageHours = Math.floor(ageMs / (3600 * 1000));
        const remainingHours = Math.max(0, 24 - ageHours);
        const isExpired = ageHours >= 24;

        let distanceBadge = "";
        if (vesselPositionRef.current && p.lat && p.lon) {
          const dMeters = haversineDistanceMeters(
            vesselPositionRef.current.lat,
            vesselPositionRef.current.lon,
            Number(p.lat),
            Number(p.lon)
          );
          const dNm = (dMeters / 1852).toFixed(1);
          distanceBadge = ` • 📍 A ${dNm} NM de proa`;
        }

        const validityHtml = isExpired
          ? `<span style="color: #FF453A; font-weight: 600;">⚠️ EXPIRADO (>24h) — Archivo</span>`
          : `<span style="color: #30D158; font-weight: 600;">⏱️ Hace ${ageHours}h (Vigente por ${remainingHours}h)</span>`;

        const popupHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #FFFFFF; min-width: 260px; max-width: 320px; padding: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
              <span style="font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; color: #FF5722; background: rgba(255, 87, 34, 0.16); border: 1px solid rgba(255, 87, 34, 0.45); border-radius: 999px; padding: 2px 8px;">
                📻 RADIO COMUNIDAD
              </span>
              <span style="font-size: 10px; font-family: monospace; opacity: 0.85;">
                ${validityHtml}
              </span>
            </div>

            <div style="font-weight: 700; font-size: 13px; line-height: 1.3; margin-bottom: 4px; color: #FFFFFF;">
              ${p.title}
            </div>

            <div style="font-size: 11px; font-family: monospace; color: #00E5FF; margin-bottom: 8px;">
              👤 ${p.author_name} • ⛵ ${p.vessel_name}${distanceBadge}
            </div>

            <p style="font-size: 12px; line-height: 1.45; opacity: 0.92; margin-bottom: 8px; background: rgba(255,255,255,0.05); padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
              "${p.content}"
            </p>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 10px; font-family: monospace; margin-bottom: 8px;">
              <div style="background: rgba(255,255,255,0.04); padding: 5px 6px; border-radius: 6px;">
                <div style="opacity: 0.55;">CONDICIÓN VIENTO</div>
                <div style="font-weight: bold; color: #FF9F0A;">${p.wind_conditions || "Calma"}</div>
              </div>
              <div style="background: rgba(255,255,255,0.04); padding: 5px 6px; border-radius: 6px;">
                <div style="opacity: 0.55;">CADENA & TENEDERO</div>
                <div style="font-weight: bold; color: #00E676;">${p.chain_payout_m ? p.chain_payout_m + "m " : ""}${p.seabed_type || "Arena"}</div>
              </div>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px; font-size: 10px; font-family: monospace;">
              <span style="color: #00E676; font-weight: bold;">
                ▲ ${p.upvotes || 18} confirmaciones
              </span>
              <span style="color: rgba(255,255,255,0.5); font-weight: 500;">
                TTL 24H • LOCAL
              </span>
            </div>
          </div>
        `;

        new maplibregl.Popup({
          className: "marinos-tactical-popup",
          closeButton: true,
          closeOnClick: true,
          maxWidth: "340px",
        })
          .setLngLat(coordinates)
          .setHTML(popupHtml)
          .addTo(map);
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update GeoJSON layers on state/props change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    addNauticalOverlays(map);

    const routeSource = map.getSource("gpx-route") as
      | maplibregl.GeoJSONSource
      | undefined;
    if (routeSource) {
      routeSource.setData({
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: waypoints.map((wp) => [wp.lon, wp.lat]),
        },
      });
    }

    const trackSource = map.getSource("recorded-track") as
      | maplibregl.GeoJSONSource
      | undefined;
    if (trackSource) {
      trackSource.setData({
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: trackPoints.map((pt) => [pt.lon, pt.lat]),
        },
      });
    }

    const wpSource = map.getSource("gpx-waypoints") as
      | maplibregl.GeoJSONSource
      | undefined;
    if (wpSource) {
      wpSource.setData({
        type: "FeatureCollection",
        features: waypoints.map((wp, idx) => ({
          type: "Feature" as const,
          properties: { name: wp.name, idx: idx + 1 },
          geometry: {
            type: "Point" as const,
            coordinates: [wp.lon, wp.lat],
          },
        })),
      });
    }

    const vesselSource = map.getSource("vessel-pos") as
      | maplibregl.GeoJSONSource
      | undefined;
    if (vesselSource) {
      vesselSource.setData({
        type: "Feature",
        properties: { title: "SV Albatros" },
        geometry: {
          type: "Point",
          coordinates: [vesselPosition.lon, vesselPosition.lat],
        },
      });
    }

    const courseVectorSource = map.getSource("course-vector-source") as
      | maplibregl.GeoJSONSource
      | undefined;
    if (courseVectorSource) {
      courseVectorSource.setData(courseVectorGeoJSON);
    }

    const swingSource = map.getSource("swing-circle") as
      | maplibregl.GeoJSONSource
      | undefined;
    if (swingSource) {
      swingSource.setData(
        createGeoJSONCircle(
          anchorPosition.lon,
          anchorPosition.lat,
          swingRadiusMeters * 6
        )
      );
    }

    const reportsSource = map.getSource("community-pins-source") as
      | maplibregl.GeoJSONSource
      | undefined;
    if (reportsSource) {
      reportsSource.setData({
        type: "FeatureCollection",
        features: effectiveReports.map((r) => ({
          type: "Feature" as const,
          properties: {
            id: r.id,
            author_name: r.author_name,
            vessel_name: r.vessel_name,
            title: r.title,
            content: r.content,
            report_type: r.report_type,
            wind_conditions: r.wind_conditions || "",
            chain_payout_m: r.chain_payout_m || 0,
            seabed_type: r.seabed_type || "",
            upvotes: r.upvotes,
            created_at: r.created_at,
            lat: r.lat,
            lon: r.lon,
          },
          geometry: {
            type: "Point" as const,
            coordinates: [r.lon, r.lat],
          },
        })),
      });
    }

    if (map.getLayer("swing-circle-fill")) {
      map.setPaintProperty(
        "swing-circle-fill",
        "fill-color",
        isDragging ? "#FF2D55" : "#00E676"
      );
    }
    if (map.getLayer("swing-circle-line")) {
      map.setPaintProperty(
        "swing-circle-line",
        "line-color",
        isDragging ? "#FF2D55" : "#00E676"
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    waypoints,
    vesselPosition,
    anchorPosition,
    swingRadiusMeters,
    isDragging,
    trackPoints,
    effectiveReports,
    courseVectorGeoJSON,
  ]);

  // FOLLOW-ME CAMERA ENGINE: Smoothly ease camera to vessel position if follow is active
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !followVessel) return;

    map.easeTo({
      center: [vesselPosition.lon, vesselPosition.lat],
      duration: 650,
      essential: true,
    });
  }, [vesselPosition, followVessel]);

  // ORIENTATION ENGINE: North-Up (0°) vs Course-Up (vessel COG)
  // P1.1: Deadband / Damping Filter: Only rotate when speed >= 0.5 kn and angular delta > 2.5°
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (orientationMode === "course-up") {
      if (
        vesselSogKn !== undefined &&
        vesselSogKn >= 0.5 &&
        vesselCogDeg !== undefined
      ) {
        const angularDiff = Math.abs(
          ((vesselCogDeg - lastHeadingRef.current + 540) % 360) - 180
        );
        if (angularDiff > 2.5) {
          lastHeadingRef.current = vesselCogDeg;
          map.rotateTo(vesselCogDeg, { duration: 600 });
        }
      } else if (
        lastHeadingRef.current &&
        Math.abs(map.getBearing() - lastHeadingRef.current) > 1.0
      ) {
        // Freeze at last stable heading when stationary / drifting
        map.rotateTo(lastHeadingRef.current, { duration: 400 });
      }
    } else if (orientationMode === "north-up") {
      if (Math.abs(map.getBearing()) > 0.5) {
        map.rotateTo(0, { duration: 600 });
      }
    }
  }, [orientationMode, vesselCogDeg, vesselSogKn]);

  // Anchor selection zoom
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedAnchorage) return;
    map.flyTo({
      center: [selectedAnchorage.lon, selectedAnchorage.lat],
      zoom: 11.4,
      duration: 900,
    });
  }, [selectedAnchorage]);

  // Handler to toggle orientation mode
  const handleToggleOrientation = () => {
    if (orientationMode === "north-up") {
      setOrientation("course-up");
    } else {
      setOrientation("north-up");
    }
  };

  // Handler to toggle / center follow-me
  const handleToggleFollow = () => {
    const nextState = !followVessel;
    setFollow(nextState);
    if (nextState && mapRef.current) {
      mapRef.current.easeTo({
        center: [vesselPosition.lon, vesselPosition.lat],
        duration: 700,
        essential: true,
      });
    }
  };

  return (
    <div
      className={
        fullScreen
          ? "fixed inset-0 w-screen h-screen z-0"
          : "relative w-full h-[460px] rounded-2xl overflow-hidden border border-white/5 shadow-2xl shadow-black/80"
      }
    >
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* TOP FLOATING ACTIVE NAVIGATION HUD OVERLAY */}
      {navStats && (
        <div className="absolute top-3 left-3 right-3 sm:left-4 sm:right-auto z-20 max-w-md">
          <div
            className={`rounded-2xl border backdrop-blur-xl shadow-2xl transition-all ${isNight
              ? "bg-black/95 border-[#FF1E1E]/40 text-[#FF453A]"
              : "bg-[#040B16]/95 border-white/10 text-white"
              }`}
          >
            {/* Header row */}
            <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/5 text-xs font-mono">
              <div className="flex items-center gap-2 truncate">
                <Navigation className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="font-semibold text-white truncate">
                  {navStats.wpName}
                </span>
                {waypoints.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedWpIdx((prev) => (prev + 1) % waypoints.length)
                    }
                    className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-cyan-400 flex items-center gap-0.5 transition"
                    title="Pasar al siguiente Waypoint"
                  >
                    Sig <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setHudCollapsed((c) => !c)}
                className="text-[10px] text-white/50 hover:text-white transition px-1"
              >
                {hudCollapsed ? "Ver HUD" : "Ocultar"}
              </button>
            </div>

            {/* Tactical Glanceable Telemetry Grid */}
            {!hudCollapsed && (
              <div className="p-3 grid grid-cols-4 gap-2 text-center font-mono">
                {/* DTW */}
                <div className="p-1.5 rounded-lg bg-white/5 border border-white/5">
                  <div className="text-[9px] uppercase tracking-wider opacity-60">
                    DTW
                  </div>
                  <div className="text-base sm:text-lg font-bold text-cyan-400">
                    {navStats.dtwNm}{" "}
                    <span className="text-[10px] font-normal opacity-70">
                      NM
                    </span>
                  </div>
                </div>

                {/* BTW */}
                <div className="p-1.5 rounded-lg bg-white/5 border border-white/5">
                  <div className="text-[9px] uppercase tracking-wider opacity-60">
                    BTW
                  </div>
                  <div className="text-base sm:text-lg font-bold text-emerald-400">
                    {navStats.btwDeg}°
                  </div>
                </div>

                {/* SOG */}
                <div className="p-1.5 rounded-lg bg-white/5 border border-white/5">
                  <div className="text-[9px] uppercase tracking-wider opacity-60">
                    SOG
                  </div>
                  <div className="text-base sm:text-lg font-bold text-white">
                    {(vesselSogKn || 0).toFixed(1)}{" "}
                    <span className="text-[10px] font-normal opacity-70">
                      kn
                    </span>
                  </div>
                </div>

                {/* ETA */}
                <div className="p-1.5 rounded-lg bg-white/5 border border-white/5">
                  <div className="text-[9px] uppercase tracking-wider opacity-60">
                    ETA
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-amber-400 pt-1">
                    {navStats.etaText}
                  </div>
                </div>

                {/* Steering Guidance Advice Bar */}
                <div className="col-span-4 mt-1 flex items-center justify-between px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-[11px]">
                  <span className="opacity-60">Rumbo a gobernar:</span>
                  <span
                    className={`font-bold font-mono ${Math.abs(navStats.steerDelta) <= 2
                      ? "text-emerald-400"
                      : "text-amber-400 animate-pulse"
                      }`}
                  >
                    {navStats.steerAdvice}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FLOATING TACTICAL CONTROL BAR (Follow-Me, Course-Up, Wake Lock, Radio TTL) */}
      <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2">
        {/* Follow-Me Auto-Center Button */}
        <button
          type="button"
          onClick={handleToggleFollow}
          data-testid="follow-vessel-btn"
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-semibold backdrop-blur-xl border shadow-xl transition-all active:scale-95 ${followVessel
            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-cyan-900/30"
            : "bg-[#040B16]/90 text-white/70 border-white/10 hover:border-white/30"
            }`}
          title={
            followVessel
              ? "Cámara bloqueada al barco (Follow-Me activo)"
              : "Cámara libre. Clic para centrar y seguir al barco"
          }
        >
          <Crosshair
            className={`w-4 h-4 ${followVessel ? "text-cyan-400 animate-spin" : "opacity-60"
              }`}
          />
          <span>{followVessel ? "SIGUIENDO BARCO" : "CENTRAR BARCO"}</span>
        </button>

        {/* Orientation Toggle: North-Up vs Course-Up */}
        <button
          type="button"
          onClick={handleToggleOrientation}
          data-testid="orientation-toggle-btn"
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-semibold backdrop-blur-xl border shadow-xl transition-all active:scale-95 ${orientationMode === "course-up"
            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-emerald-900/30"
            : "bg-[#040B16]/90 text-white/70 border-white/10 hover:border-white/30"
            }`}
          title="Alternar entre orientación Norte Arriba y Proa Arriba"
        >
          <Compass
            className={`w-4 h-4 ${orientationMode === "course-up" ? "text-emerald-400" : "opacity-60"
              }`}
          />
          <span>
            {orientationMode === "course-up"
              ? `PROA ARRIBA (${vesselCogDeg ?? 0}°)`
              : "NORTE ARRIBA (0°)"}
          </span>
        </button>

        {/* Screen Wake Lock Button */}
        {onToggleWakeLock && (
          <button
            type="button"
            onClick={onToggleWakeLock}
            data-testid="wake-lock-toggle-btn"
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-semibold backdrop-blur-xl border shadow-xl transition-all active:scale-95 ${wakeLockActive
              ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
              : "bg-[#040B16]/90 text-white/70 border-white/10 hover:border-white/30"
              }`}
            title="Mantener pantalla activa (evita que el dispositivo se apague en el cockpit)"
          >
            <Zap
              className={`w-4 h-4 ${wakeLockActive ? "text-amber-400 animate-pulse" : "opacity-60"
                }`}
            />
            <span>
              {wakeLockActive ? "PANTALLA ACTIVA" : "AHORRO PANTALLA"}
            </span>
          </button>
        )}

        {/* Touch Lock Toggle Button (Wet Screen / Rain Protection) */}
        <button
          type="button"
          onClick={() => setIsTouchLocked((prev) => !prev)}
          data-testid="touch-lock-toggle-btn"
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-semibold backdrop-blur-xl border shadow-xl transition-all active:scale-95 ${isTouchLocked
            ? "bg-cyan-500/30 text-cyan-300 border-cyan-400 shadow-cyan-900/40"
            : "bg-[#040B16]/90 text-white/70 border-white/10 hover:border-white/30"
            }`}
          title="Bloquear pantalla táctil contra lluvia y toques accidentales"
        >
          {isTouchLocked ? (
            <Lock className="w-4 h-4 text-cyan-400 animate-pulse" />
          ) : (
            <Unlock className="w-4 h-4 opacity-60" />
          )}
          <span>{isTouchLocked ? "TÁCTIL BLOQUEADO" : "BLOQUEAR TÁCTIL"}</span>
        </button>

        {/* Radio Comunidad TTL Filter Pill */}
        <div className="flex items-center gap-2 bg-[#040B16]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-xs font-mono shadow-xl">
          <span className="w-2 h-2 rounded-full bg-[#FF5722] animate-pulse" />
          <span className="text-white/90 font-medium hidden sm:inline">
            Radio Comunidad
          </span>
          <button
            type="button"
            onClick={() => setFilter24hOnly((prev) => !prev)}
            className="text-[11px] px-2 py-0.5 rounded border border-white/15 bg-white/5 hover:bg-white/10 text-orange-400 font-mono transition-colors"
            title="Alternar entre reportes de las últimas 24h o historial completo"
          >
            {filter24hOnly ? "Filtro: 24h TTL" : "Filtro: Histórico"}
          </button>
        </div>
      </div>

      {/* Touch Lock Full Screen Overlay & Unlock Floating CTA */}
      {isTouchLocked && (
        <>
          <div
            className="absolute inset-0 z-30 pointer-events-auto bg-black/15 backdrop-blur-[0.5px]"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          />
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 pointer-events-auto">
            <div className="bg-[#040B16]/95 border border-cyan-500/50 px-4 py-2 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-2.5 text-xs font-mono text-cyan-300">
              <Lock className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span>TÁCTIL BLOQUEADO (PROTECCIÓN LLUVIA)</span>
            </div>
            <button
              type="button"
              onMouseDown={startUnlockHold}
              onMouseUp={cancelUnlockHold}
              onTouchStart={startUnlockHold}
              onTouchEnd={cancelUnlockHold}
              data-testid="hold-to-unlock-btn"
              className="relative px-6 py-3 rounded-2xl bg-cyan-500 text-black font-mono font-bold text-xs shadow-xl active:scale-95 transition-transform overflow-hidden select-none cursor-pointer flex items-center gap-2"
            >
              <div
                className="absolute inset-0 bg-white/40 transition-all"
                style={{ width: `${unlockProgressPct}%` }}
              />
              <Unlock className="w-4 h-4 relative z-10" />
              <span className="relative z-10">
                {unlockPressStart ? `Mantén presionado... ${unlockProgressPct}%` : "Mantén presionado 2.5s para desbloquear"}
              </span>
            </button>
          </div>
        </>
      )}

      {/* Safety Nautical Disclaimer - R-4.8.1 */}
      <div
        data-testid="nautical-map-disclaimer"
        className="absolute bottom-2 right-2 pointer-events-none z-10 px-2.5 py-1 rounded bg-black/85 backdrop-blur border border-white/10 text-[10px] font-mono text-white/75 max-w-[340px] text-right"
      >
        Carta referencial — no apta para navegación. Usa cartas oficiales SHOA y
        tu plotter.
      </div>
    </div>
  );
}
