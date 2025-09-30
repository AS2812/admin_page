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
  height = 360,
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
  const { client } = useSupabase();
  const [mapReady, setMapReady] = useState(false);

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
      const q = (query || "").trim().toLowerCase();
      points
        .filter((p: MapPoint) => (kind === "all" ? true : p.type === kind))
        .filter((p: MapPoint) => !q || [p.title, p.status, String(p.id)].some((v) => v?.toLowerCase().includes(q)))
        .forEach((point: MapPoint) => {
          const el = document.createElement("div");
          el.style.width = "38px";
          el.style.height = "38px";
          el.style.position = "relative";
          el.style.borderRadius = "19px";
          el.style.backgroundColor = "#fff";
          el.style.backgroundImage = `url(${getCategoryIcon(point.category)})`;
          el.style.backgroundSize = "70%";
          el.style.backgroundRepeat = "no-repeat";
          el.style.backgroundPosition = "center";
          el.style.boxShadow = "0 8px 18px rgba(15, 23, 42, 0.25)";
          el.style.border = "1px solid rgba(148, 163, 184, 0.45)";
          el.style.cursor = "pointer";
          el.style.display = "flex";
          el.style.alignItems = "center";
          el.style.justifyContent = "center";

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
  }, [clearMarkers, kind, query]);

  useEffect(() => {
    const keyVite = import.meta.env.VITE_MAPTILER_KEY as string | undefined;
    const keyNext = import.meta.env.NEXT_PUBLIC_MAPTILER_KEY as string | undefined;
    const keyBare = (import.meta as any).env?.MAPTILER_KEY as string | undefined;
    const apiKey = keyNext || keyVite || keyBare;
    if (!apiKey) return;
    if (needsHttps) {
      console.warn("Geolocation requires HTTPS in production. Map will load without user location.");
    }

    let disposed = false;

    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (disposed) return;
      maplibreModuleRef.current = maplibregl;

      mapRef.current = new maplibregl.Map({
        container: containerRef.current!,
        style: `https://api.maptiler.com/maps/streets/style.json?key=${apiKey}`,
        center,
        zoom,
      });
      mapRef.current.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

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
        setMapReady(true);
        refreshMarkers();
      });
    })();

    return () => {
      disposed = true;
      setMapReady(false);
      clearMarkers();
      try {
        geoControlRef.current = null;
        mapRef.current?.remove();
      } catch {}
      mapRef.current = null;
    };
  }, [center, zoom, needsHttps, refreshMarkers, clearMarkers]);

  useEffect(() => {
    if (!client || !mapReady) return;
    const channel = client
      .channel("reports_map_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, () => {
        refreshMarkers();
      })
      .subscribe();

    return () => {
      try {
        client.removeChannel(channel);
      } catch {}
    };
  }, [client, mapReady, refreshMarkers]);

  // Re-apply filtering when kind/query change
  useEffect(() => {
    if (!mapReady) return;
    refreshMarkers();
  }, [mapReady, kind, query, refreshMarkers]);

  return (
    <div style={{ width: "100%", height, borderRadius: 12, overflow: "hidden", position: "relative" }} ref={containerRef}>
      {needsHttps && (
        <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, background: "#111c", color: "#fff", padding: "8px 12px", borderRadius: 8, fontSize: 12 }}>
          Enable HTTPS to allow live geolocation.
        </div>
      )}
    </div>
  );
}