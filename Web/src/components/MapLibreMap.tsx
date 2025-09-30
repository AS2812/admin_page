import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchReportLocations } from "../utils/supabaseQueries";
import { getCategoryIcon } from "../utils/categoryIcons";
import { useSupabase } from "../providers/SupabaseProvider";

type MapPoint = {
  id: number;
  lon: number;
  lat: number;
  title: string;
  status: string;
  category?: string;
  type?: "incident" | "complaint";
};

export default function MapLibreMap({
  center = [31.233, 30.044],
  zoom = 11,
  height = 560,
  kind = "all",
  query = "",
}: {
  center?: [number, number];
  zoom?: number;
  height?: number;
  kind?: "all" | "incident" | "complaint";
  query?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const maplibreModuleRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const geoControlRef = useRef<any>(null);
  const initOnceRef = useRef(false);
  const { client } = useSupabase();
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const kindRef = useRef(kind);
  const queryRef = useRef(query);
  const refreshTimerRef = useRef<number | null>(null);

  // Keep latest filter values in refs so the marker refresh stays stable
  // without causing the map to re-initialize when filters change.
  useEffect(() => { kindRef.current = kind; }, [kind]);
  useEffect(() => { queryRef.current = query; }, [query]);

  const needsHttps = useMemo(() => {
    if (typeof window === "undefined") return false;
    const proto = window.location.protocol;
    const host = window.location.hostname;
    if (proto === "https:") return false;
    return host !== "localhost" && host !== "127.0.0.1";
  }, []);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((marker) => {
      try {
        marker.remove();
      } catch {}
    });
    markersRef.current = [];
  }, []);

  const refreshMarkers = useCallback(async () => {
    if (!mapRef.current) return;
    try {
      const points = await fetchReportLocations();
      const maplibregl = maplibreModuleRef.current;
      if (!maplibregl) return;

      clearMarkers();
      const q = (queryRef.current || "").trim().toLowerCase();
      points
        .filter((p: MapPoint) => (kindRef.current === "all" ? true : p.type === kindRef.current))
        .filter((p: MapPoint) => !q || [p.title, p.status, String(p.id)].some((v) => v?.toLowerCase().includes(q)))
        .forEach((point: MapPoint) => {
          const el = document.createElement("div");
          el.style.width = "48px";
          el.style.height = "48px";
          el.style.position = "relative";
          el.style.borderRadius = "24px";
          el.style.backgroundColor = "#fff";
          el.style.backgroundImage = `url(${getCategoryIcon(point.category)})`;
          el.style.backgroundSize = "70%";
          el.style.backgroundRepeat = "no-repeat";
          el.style.backgroundPosition = "center";
          el.style.boxShadow = "0 10px 22px rgba(15, 23, 42, 0.28)";
          el.style.border = "1px solid rgba(148, 163, 184, 0.55)";
          el.style.cursor = "pointer";
          el.style.display = "flex";
          el.style.alignItems = "center";
          el.style.justifyContent = "center";

          const ring = document.createElement("div");
          ring.style.position = "absolute";
          ring.style.top = "-5px";
          ring.style.left = "-5px";
          ring.style.width = "58px";
          ring.style.height = "58px";
          ring.style.borderRadius = "29px";
          const ringColor = point.type === "incident" ? "#ef4444" : point.type === "complaint" ? "#0ea5e9" : "#22c55e";
          ring.style.border = `3px solid ${ringColor}`;
          ring.style.opacity = "0.9";
          el.appendChild(ring);

          const statusChip = document.createElement("span");
          statusChip.textContent = point.status?.toUpperCase() || "";
          statusChip.style.position = "absolute";
          statusChip.style.bottom = "-12px";
          statusChip.style.left = "50%";
          statusChip.style.transform = "translateX(-50%)";
          statusChip.style.fontSize = "9px";
          statusChip.style.padding = "2px 8px";
          statusChip.style.borderRadius = "999px";
          statusChip.style.background = point.status === "resolved" ? "#22c55e" : point.status === "assigned" ? "#f59e0b" : "#ef4444";
          statusChip.style.color = "#fff";
          statusChip.style.fontWeight = "600";
          statusChip.style.letterSpacing = "0.4px";
          el.appendChild(statusChip);

          const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
            .setLngLat([point.lon, point.lat])
            .setPopup(
              new maplibregl.Popup({ closeButton: true, offset: 24 }).setHTML(
                `<strong>${point.title}</strong><br/>${point.category || "Uncategorised"}`
              )
            )
            .addTo(mapRef.current);
          markersRef.current.push(marker);
        });
    } catch (error) {
      console.warn("refreshMarkers failed", error);
    }
  }, [clearMarkers]);

  // Debounced wrapper to avoid rapid refresh loops during filter typing or bursts
  const debouncedRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshMarkers();
    }, 250);
  }, [refreshMarkers]);

  useEffect(() => {
    const keyVite = import.meta.env.VITE_MAPTILER_KEY as string | undefined;
    const keyNext = import.meta.env.NEXT_PUBLIC_MAPTILER_KEY as string | undefined;
    const keyBare = (import.meta as any).env?.MAPTILER_KEY as string | undefined;
    const apiKey = keyNext || keyVite || keyBare;
    console.info("MapLibreMap init", {
      hasApiKey: !!apiKey,
      keySources: { VITE: !!keyVite, NEXT: !!keyNext, BARE: !!keyBare },
      center,
      zoom,
    });
    if (needsHttps) {
      console.warn("Geolocation requires HTTPS in production. Map will load without user location.");
    }

    if (initOnceRef.current) return; // guard against re-initialization
    initOnceRef.current = true;
    let disposed = false;
    let timeoutId: number | null = null;

    (async () => {
      try {
        const module = await import("maplibre-gl");
        if (disposed) return;
        const maplibregl = module?.default ?? module;
        if (!maplibregl?.Map) {
          throw new Error("MapLibre GL failed to load");
        }
        maplibreModuleRef.current = maplibregl;

        if (!containerRef.current) {
          throw new Error("Map container not available");
        }

        const fallbackStyle = {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      } as any;

      mapRef.current = new maplibregl.Map({
        container: containerRef.current,
        style: apiKey ? `https://api.maptiler.com/maps/streets/style.json?key=${apiKey}` : fallbackStyle,
        center,
        zoom,
      });
      mapRef.current.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

      // Bubble up maplibre errors to show a visible fallback overlay
      mapRef.current.on("error", (e: any) => {
        try { console.warn("MapLibre error", e?.error || e); } catch {}
        setLoadError(e?.error?.message ?? "Map failed to load.");
      });

      geoControlRef.current = new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
        showUserLocation: true,
        showAccuracyCircle: false,
      });
      mapRef.current.addControl(geoControlRef.current, "top-right");

      const locate = document.createElement("button");
      locate.textContent = "Loc";
      locate.title = "Locate me";
      locate.style.cssText = "background:#111b; color:#fff; border:none; width:32px; height:32px; border-radius:16px; cursor:pointer;";
      locate.onclick = () => {
        try {
          geoControlRef.current?.trigger();
        } catch (error) {
          console.warn("Geolocate trigger failed", error);
        }
      };
      const ctl = document.createElement("div");
      ctl.style.cssText = "position:absolute; top:10px; left:10px; z-index:10;";
      ctl.appendChild(locate);
      containerRef.current?.appendChild(ctl);

      mapRef.current.on("load", () => {
        if (disposed) return;
        if (timeoutId) { window.clearTimeout(timeoutId); timeoutId = null; }
        setMapReady(true);
        console.debug("MapLibreMap: load event fired; refreshing markers");
        refreshMarkers();
      });

      mapRef.current.on("styledata", () => {
        console.debug("MapLibreMap: styledata event");
      });
      mapRef.current.on("sourcedata", (e: any) => {
        try {
          console.debug("MapLibreMap: sourcedata", { sourceId: e?.sourceId, loaded: e?.isSourceLoaded });
        } catch {}
      });

      // If the map doesn't initialize promptly, surface a helpful message
      timeoutId = window.setTimeout(() => {
        if (!mapReady && !disposed) {
          setLoadError(prev => prev ?? "Map did not initialize. Check API key and network.");
        }
      }, 2500);

      // Keep canvas sized correctly and resilient to tab switches
      try {
        // Resize observer on container
        const ro = new ResizeObserver(() => {
          try { mapRef.current?.resize(); } catch {}
        });
        ro.observe(containerRef.current!);
        // Store for cleanup
        (mapRef.current as any)._ro = ro;

        // Visibility change – re-check size when returning to tab
        const onVis = () => {
          if (document.visibilityState === "visible") {
            try { mapRef.current?.resize(); } catch {}
            debouncedRefresh();
          }
        };
        document.addEventListener("visibilitychange", onVis);
        (mapRef.current as any)._onVis = onVis;

        // WebGL context loss/restoration handling
        const canvas: HTMLCanvasElement | null = mapRef.current?.getCanvas?.() || null;
        if (canvas) {
          const onLost = (e: Event) => {
            try { (e as any).preventDefault?.(); } catch {}
            console.warn("MapLibre WebGL context lost");
          };
          const onRestored = () => {
            console.info("MapLibre WebGL context restored");
            try { mapRef.current?.resize(); } catch {}
            debouncedRefresh();
          };
          canvas.addEventListener("webglcontextlost", onLost, false);
          canvas.addEventListener("webglcontextrestored", onRestored, false);
          (mapRef.current as any)._onLost = onLost;
          (mapRef.current as any)._onRestored = onRestored;
        }
      } catch (err) {
        console.warn("map resilience setup failed", err);
      }
      } catch (error) {
        console.error("MapLibreMap initialisation failed", error);
        if (!disposed) {
          setLoadError((prev) => prev ?? "Unable to load interactive map.");
        }
      }
    })();

    return () => {
      disposed = true;
      setMapReady(false);
      if (timeoutId) { window.clearTimeout(timeoutId); timeoutId = null; }
      clearMarkers();
      try {
        geoControlRef.current = null;
        mapRef.current?.remove();
      } catch {}
      try {
        const ro = (mapRef.current as any)?._ro as ResizeObserver | undefined;
        const onVis = (mapRef.current as any)?._onVis as ((this: Document, ev: Event) => any) | undefined;
        const onLost = (mapRef.current as any)?._onLost as ((this: HTMLCanvasElement, ev: Event) => any) | undefined;
        const onRestored = (mapRef.current as any)?._onRestored as ((this: HTMLCanvasElement, ev: Event) => any) | undefined;
        if (ro) ro.disconnect();
        if (onVis) document.removeEventListener("visibilitychange", onVis);
        const canvas: HTMLCanvasElement | null = mapRef.current?.getCanvas?.() || null;
        if (canvas) {
          if (onLost) canvas.removeEventListener("webglcontextlost", onLost, false);
          if (onRestored) canvas.removeEventListener("webglcontextrestored", onRestored, false);
        }
      } catch {}
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!client || !mapReady) return;
    const channel = client
      .channel("reports_map_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, () => {
        debouncedRefresh();
      })
      .subscribe();

    return () => {
      try {
        client.removeChannel(channel);
      } catch {}
    };
  }, [client, mapReady, debouncedRefresh]);

  // Re-apply filtering when kind/query change
  useEffect(() => {
    if (!mapReady) return;
    debouncedRefresh();
  }, [mapReady, kind, query, debouncedRefresh]);

  // Periodic refresh to keep markers up-to-date even without realtime
  useEffect(() => {
    if (!mapReady) return;
    const id = window.setInterval(() => {
      try {
        refreshMarkers();
      } catch (e) {
        console.warn("Periodic marker refresh failed", e);
      }
    }, 30000);
    return () => window.clearInterval(id);
  }, [mapReady, refreshMarkers]);

  return (
    <div
      style={{
        width: "100%",
        height,
        minHeight: height,
        borderRadius: 12,
        overflow: "hidden",
        position: "relative",
        // Subtle placeholder background to make it clear there's a map area
        background: loadError ? "repeating-linear-gradient(0deg, #f1f5f9, #f1f5f9 1px, transparent 1px, transparent 20px)" : undefined,
        border: loadError ? "1px solid var(--line,#e5e7eb)" : undefined,
      }}
      ref={containerRef}
    >
      {loadError && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            color: "#111827",
            background: "linear-gradient(180deg, rgba(255,255,255,.92), rgba(255,255,255,.86))",
            fontSize: 14,
            textAlign: "center",
            gap: 10,
          }}
        >
          <span aria-hidden style={{ fontSize: 18 }}>🗺️</span>
          <span>
            {loadError}
            <br/>
            {"Check network/console logs. If using MapTiler, verify your API key."}
          </span>
        </div>
      )}
      {needsHttps && (
        <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, background: "#111c", color: "#fff", padding: "8px 12px", borderRadius: 8, fontSize: 12 }}>
          Enable HTTPS to allow live geolocation.
        </div>
      )}
    </div>
  );
}