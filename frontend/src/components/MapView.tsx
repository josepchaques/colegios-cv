"use client";
import { useEffect, useRef, useCallback } from "react";
import type { RecommendedSchool } from "@/lib/types";

interface Props {
  schools: RecommendedSchool[];
  userLat: number;
  userLon: number;
  selected: RecommendedSchool | null;
  hovered: number | null;
  onSelectSchool: (s: RecommendedSchool) => void;
}

function scoreColor(score: number) {
  if (score >= 0.75) return "#22c55e";
  if (score >= 0.55) return "#f59e0b";
  return "#ef4444";
}

export function MapView({ schools, userLat, userLon, selected, hovered, onSelectSchool }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const mapboxRef    = useRef<any>(null);
  const mapLoadedRef = useRef(false);

  // markersRef: map id → mapboxgl.Marker (holds the outer element)
  const markersRef   = useRef<Map<number, any>>(new Map());
  // innerRef: map id → inner animated div (safe to transform)
  const innerRef     = useRef<Map<number, HTMLElement>>(new Map());

  // Latest values via refs so effects don't need them as deps
  const schoolsRef   = useRef(schools);
  const onSelectRef  = useRef(onSelectSchool);
  const coordsRef    = useRef({ lat: userLat, lon: userLon });

  useEffect(() => { schoolsRef.current  = schools;        }, [schools]);
  useEffect(() => { onSelectRef.current = onSelectSchool; }, [onSelectSchool]);
  useEffect(() => { coordsRef.current   = { lat: userLat, lon: userLon }; }, [userLat, userLon]);

  const renderMarkers = useCallback((schoolList: RecommendedSchool[]) => {
    const mapboxgl = mapboxRef.current;
    const map      = mapRef.current;
    if (!mapboxgl || !map) return;

    // Remove old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current.clear();
    innerRef.current.clear();

    schoolList.forEach((school, idx) => {
      const color = scoreColor(school.scores.final);
      const pct   = Math.round(school.scores.final * 100);

      /*
       * MapboxGL v3 writes `transform: translate(x,y)` directly onto the element
       * passed to new Marker({ element }). If we also set transform on that same
       * element (e.g. scale for hover), we overwrite the translate and all markers
       * jump to (0,0). Fix: keep the outer element clean for MapboxGL; animate
       * only an inner child element.
       */
      const outer = document.createElement("div");
      // Outer must have no transform/position styles — MapboxGL owns those
      outer.style.cssText = "cursor:pointer; width:32px; height:32px;";

      const inner = document.createElement("div");
      inner.style.cssText = `
        width:32px; height:32px; border-radius:50%;
        background:${color}; border:2.5px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,.22);
        display:flex; align-items:center; justify-content:center;
        font-size:9px; font-weight:700; color:#fff;
        transition:transform .15s ease, box-shadow .15s ease;
        position:relative;
        user-select:none;
      `;
      inner.textContent = String(pct);

      // Rank badge
      const badge = document.createElement("div");
      badge.style.cssText = `
        position:absolute; top:-5px; right:-5px;
        width:14px; height:14px; border-radius:50%;
        background:#1e293b; color:#fff;
        font-size:7px; font-weight:700;
        display:flex; align-items:center; justify-content:center;
        border:1.5px solid #fff;
      `;
      badge.textContent = String(idx + 1);
      inner.appendChild(badge);
      outer.appendChild(inner);

      outer.addEventListener("click", () => onSelectRef.current(school));

      const marker = new mapboxgl.Marker({ element: outer })
        .setLngLat([school.lon, school.lat])
        .addTo(map);

      markersRef.current.set(school.id, marker);
      innerRef.current.set(school.id, inner);
    });

    // Fit map bounds to show all results
    if (schoolList.length > 0) {
      const { lat, lon } = coordsRef.current;
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([lon, lat]);
      schoolList.forEach(s => bounds.extend([s.lon, s.lat]));
      map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 800 });
    }
  }, []);

  // Init map once
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || !containerRef.current || mapRef.current) return;

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (!containerRef.current) return;
      mapboxgl.accessToken = token;
      mapboxRef.current = mapboxgl;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [coordsRef.current.lon, coordsRef.current.lat],
        zoom: 12,
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
      mapRef.current = map;

      map.on("load", () => {
        mapLoadedRef.current = true;

        // User location pin
        const dot = document.createElement("div");
        dot.style.cssText = `
          width:14px; height:14px; border-radius:50%;
          background:#3b5bdb; border:2.5px solid #fff;
          box-shadow:0 2px 8px rgba(59,91,219,.4);
        `;
        new mapboxgl.Marker({ element: dot })
          .setLngLat([coordsRef.current.lon, coordsRef.current.lat])
          .addTo(map);

        // Draw any schools that arrived before the map finished loading
        if (schoolsRef.current.length > 0) {
          renderMarkers(schoolsRef.current);
        }
      });
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      mapboxRef.current = null;
      mapLoadedRef.current = false;
      markersRef.current.clear();
      innerRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render markers when schools list changes
  useEffect(() => {
    if (!mapLoadedRef.current) return;
    renderMarkers(schools);
  }, [schools, renderMarkers]);

  // Highlight selected / hovered — only touch the inner element, never the outer
  useEffect(() => {
    innerRef.current.forEach((inner, id) => {
      const active = id === selected?.id || id === hovered;
      inner.style.transform  = active ? "scale(1.25)"               : "scale(1)";
      inner.style.boxShadow  = active ? "0 4px 16px rgba(0,0,0,.3)" : "0 2px 8px rgba(0,0,0,.22)";
      inner.style.zIndex     = active ? "10"                        : "1";
    });
  }, [selected, hovered]);

  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-400">
          Añade <code className="bg-gray-200 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> en .env.local
        </p>
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full" />;
}
