"use client";

import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GPXWaypoint } from "@/lib/nautical";
import type { AnchorageSpatialRecord, TrackPoint } from "@/lib/offline/db";

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
  onSelectAnchorage,
}: NauticalMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

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
