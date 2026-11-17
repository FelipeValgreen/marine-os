const APP_CACHE_NAME = "marinos-app-shell-v3.2-tactical";
const TILE_CACHE_NAME = "marinos-nautical-tiles-v3";

const PRECACHE_ROUTES = [
  "/",
  "/login",
  "/trip/demo-trip-albatros-2026",
  "/vessels/22222222-2222-2222-2222-222222222222/handover",
  "/qr/yanmar-4jh57",
  "/qr/jabsco-wc-popa",
  "/qr/quick-windlass",
  "/manifest.json",
  "/icon.svg",
];

/**
 * Matches MapLibre vector tiles, styles, sprites, glyphs (Carto Dark Matter)
 * and OpenSeaMap nautical seamark raster tiles for aggressive Cache-First offline cartography.
 */
function isCartographicTileRequest(urlString) {
  try {
    const url = new URL(urlString);
    return (
      url.hostname.includes("basemaps.cartocdn.com") ||
      url.hostname.includes("cartocdn.com") ||
      url.hostname.includes("tiles.openseamap.org") ||
      url.hostname.includes("openseamap.org") ||
      url.pathname.endsWith(".pbf") ||
      url.pathname.includes("/seamark/")
    );
  } catch {
    return false;
  }
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ROUTES).catch(() => {});
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== APP_CACHE_NAME && key !== TILE_CACHE_NAME) {
              console.log("[SW] Deleting stale cache:", key);
              return caches.delete(key);
            }
            return Promise.resolve();
          })
        )
      ),
    ])
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // 1. Aggressive Cache-First Strategy for MapLibre & OpenSeaMap Cartographic Tiles
  if (isCartographicTileRequest(event.request.url)) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then((tileCache) => {
        return tileCache.match(event.request).then((cachedTile) => {
          if (cachedTile) {
            // Refresh asynchronously in background while returning cached tile immediately (0ms)
            fetch(event.request)
              .then((netResp) => {
                if (netResp && (netResp.status === 200 || netResp.type === "opaque")) {
                  tileCache.put(event.request, netResp.clone());
                }
              })
              .catch(() => {});
            return cachedTile;
          }

          return fetch(event.request)
            .then((networkResponse) => {
              if (
                networkResponse &&
                (networkResponse.status === 200 || networkResponse.type === "opaque")
              ) {
                tileCache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => {
              return new Response("", { status: 204, statusText: "Offline Tile Fallback" });
            });
        });
      })
    );
    return;
  }

  // 2. Network-First with App-Shell Offline Cache Fallback for Application Routes
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const cloned = response.clone();
          caches.open(APP_CACHE_NAME).then((cache) => {
            cache.put(event.request, cloned);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || caches.match("/");
        });
      })
  );
});
