"use client";

import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useLiveQuery } from "dexie-react-hooks";
import type { GPXWaypoint } from "@/lib/nautical";
import {
  db,
  type AnchorageSpatialRecord,
  type TrackPoint,
  type CommunityReportRecord,
} from "@/lib/offline/db";

interface NauticalMapProps {
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
  fullScreen = false,
  trackPoints = [],
  communityReports,
  onSelectAnchorage,
}: NauticalMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const liveReports = useLiveQuery(() => db.community_reports.toArray(), [], []);
  const effectiveReports = communityReports || liveReports || [];

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
          "circle-radius": 5,
          "circle-color": "#040B16",
          "circle-stroke-width": 2,
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
          "circle-radius": 18,
          "circle-color": "#00E5FF",
          "circle-opacity": 0.22,
        },
      });

      map.addLayer({
        id: "vessel-pos-circle",
        type: "circle",
        source: "vessel-pos",
        paint: {
          "circle-radius": 7.5,
          "circle-color": "#00E5FF",
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#040B16",
        },
      });
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: CARTO_DARK_MATTER_STYLE,
      center: [vesselPosition.lon, vesselPosition.lat],
      zoom: 10.6,
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true }),
      "bottom-right"
    );

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

        const popupHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #FFFFFF; min-width: 250px; max-width: 320px; padding: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
              <span style="font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; color: #FF5722; background: rgba(255, 87, 34, 0.16); border: 1px solid rgba(255, 87, 34, 0.45); border-radius: 999px; padding: 2px 8px;">
                ⚓ REPORTE DE CAPITÁN
              </span>
              <span style="font-size: 10px; font-family: monospace; opacity: 0.65;">
                ${p.created_at ? new Date(String(p.created_at)).toLocaleDateString('es-CL', { month: 'short', day: 'numeric' }) : 'Reciente'}
              </span>
            </div>

            <div style="font-weight: 700; font-size: 13px; line-height: 1.3; margin-bottom: 4px; color: #FFFFFF;">
              ${p.title}
            </div>

            <div style="font-size: 11px; font-family: monospace; color: #00E5FF; margin-bottom: 8px;">
              👤 ${p.author_name} • ⛵ ${p.vessel_name}
            </div>

            <p style="font-size: 12px; line-height: 1.45; opacity: 0.92; margin-bottom: 8px; background: rgba(255,255,255,0.05); padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
              "${p.content}"
            </p>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 10px; font-family: monospace; margin-bottom: 8px;">
              <div style="background: rgba(255,255,255,0.04); padding: 5px 6px; border-radius: 6px;">
                <div style="opacity: 0.55;">VIENTO</div>
                <div style="font-weight: bold; color: #FF9F0A;">${p.wind_conditions || 'Calma'}</div>
              </div>
              <div style="background: rgba(255,255,255,0.04); padding: 5px 6px; border-radius: 6px;">
                <div style="opacity: 0.55;">CADENA & FONDO</div>
                <div style="font-weight: bold; color: #00E676;">${p.chain_payout_m ? p.chain_payout_m + 'm ' : ''}${p.seabed_type || 'Arena'}</div>
              </div>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px; font-size: 10px; font-family: monospace;">
              <span style="color: #00E676; font-weight: bold;">
                ▲ ${p.upvotes || 18} confirmaciones
              </span>
              <span style="color: #FF5722; font-weight: 600;">WAZE NÁUTICO MARINOS</span>
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
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedAnchorage) return;
    map.flyTo({
      center: [selectedAnchorage.lon, selectedAnchorage.lat],
      zoom: 11.4,
      duration: 900,
    });
  }, [selectedAnchorage]);

  return (
    <div
      className={
        fullScreen
          ? "fixed inset-0 w-screen h-screen z-0"
          : "relative w-full h-[460px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
      }
    >
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}
