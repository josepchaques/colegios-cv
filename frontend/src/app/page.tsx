"use client";
import { useState, useCallback } from "react";
import clsx from "clsx";
import { useMutation } from "@tanstack/react-query";
import { SlidersHorizontal, Map, List } from "lucide-react";
import { fetchRecommendations } from "@/lib/api";
import type { RecommendRequest, RecommendedSchool } from "@/lib/types";
import { FilterPanel } from "@/components/FilterPanel";
import { SchoolList } from "@/components/SchoolList";
import { MapView } from "@/components/MapView";
import { CirclePackView } from "@/components/CirclePackView";
import { SchoolDetail } from "@/components/SchoolDetail";
import { RecommendingLoader } from "@/components/RecommendingLoader";
import { Logo } from "@/components/Logo";

const DEFAULT_REQUEST: RecommendRequest = {
  lat: 39.4699,
  lon: -0.3763,
  monthly_salary: 2000,
  school_types: [],
  preferences: {},
  max_distance_km: 10,
  limit: 20,
};

type ViewMode = "map" | "circles";
type MobileTab = "filters" | "map" | "results";

export default function Home() {
  const [req, setReq] = useState<RecommendRequest>(DEFAULT_REQUEST);
  const [selected, setSelected] = useState<RecommendedSchool | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [mobileTab, setMobileTab] = useState<MobileTab>("filters");

  const { data, mutate, isPending, isError, error } = useMutation({
    mutationFn: fetchRecommendations,
  });

  const handleSearch = useCallback(
    (newReq: RecommendRequest) => {
      setReq(newReq);
      setSelected(null);
      mutate(newReq);
      setMobileTab("map");
    },
    [mutate]
  );

  const schools = data?.results ?? [];
  const showRanking = schools.length > 0 || isPending;

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      {/* Header */}
      <header className="flex-none bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-4 z-10">
        <Logo className="h-8 w-auto lg:h-10" />
        {data && (
          <span className="ml-auto text-xs text-gray-400">
            {data.total} centros
          </span>
        )}
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — Filtros */}
        <aside className={clsx(
          "bg-white border-r border-gray-100 overflow-y-auto",
          // mobile: full width when active tab, hidden otherwise
          mobileTab === "filters" ? "flex-1" : "hidden",
          // desktop: always visible, fixed width
          "lg:flex lg:flex-none lg:w-72"
        )}>
          <FilterPanel initial={req} onSearch={handleSearch} loading={isPending} />
        </aside>

        {/* CENTER — Mapa / Circle Pack */}
        <main className={clsx(
          "relative min-w-0 flex flex-col",
          mobileTab === "map" ? "flex-1" : "hidden",
          "lg:flex lg:flex-1"
        )}>
          {/* View toggle */}
          {showRanking && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex gap-1 bg-white/90 backdrop-blur-sm rounded-xl p-1 shadow-sm border border-gray-100">
              <button
                onClick={() => setViewMode("map")}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  viewMode === "map" ? "bg-brand-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                🗺️ Mapa
              </button>
              <button
                onClick={() => setViewMode("circles")}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  viewMode === "circles" ? "bg-brand-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                🫧 Burbujas
              </button>
            </div>
          )}

          <div className="flex-1 relative">
            {isPending && <RecommendingLoader />}

            <div className={clsx("absolute inset-0", viewMode !== "map" && "invisible")}>
              <MapView
                schools={schools}
                userLat={req.lat}
                userLon={req.lon}
                selected={selected}
                hovered={hovered}
                onSelectSchool={(s) => { setSelected(s); setMobileTab("results"); }}
              />
            </div>

            {viewMode === "circles" && (
              <div className="absolute inset-0">
                <CirclePackView
                  schools={schools}
                  selected={selected}
                  onSelectSchool={setSelected}
                />
              </div>
            )}

            {isError && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 shadow-sm text-center max-w-sm">
                  <p className="text-sm font-medium text-red-700">Error al buscar</p>
                  <p className="text-xs text-red-500 mt-1">{(error as Error)?.message}</p>
                </div>
              </div>
            )}

            {!showRanking && !isError && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-white/90 backdrop-blur-sm rounded-xl px-5 py-4 shadow-sm text-center">
                  <p className="text-sm font-medium text-gray-600">Configura tu búsqueda y pulsa</p>
                  <p className="text-xs text-gray-400 mt-0.5">«Buscar colegios» para ver resultados</p>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* RIGHT — Ranking */}
        <aside className={clsx(
          "bg-white border-l border-gray-100 flex flex-col overflow-hidden",
          // mobile: full width on results tab
          mobileTab === "results" ? "flex-1 flex" : "hidden",
          // desktop: always visible when showRanking, fixed width
          showRanking ? "lg:flex lg:flex-none lg:w-80" : "lg:hidden"
        )}>
          <div className="flex-none px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">
              {isPending ? "Buscando…" : schools.length > 0 ? `${schools.length} colegios recomendados` : "Sin resultados"}
            </h2>
            {!isPending && schools.length > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">Ordenados por ajuste a tu perfil</p>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            <SchoolList
              schools={schools}
              loading={isPending}
              selected={selected?.id ?? null}
              onSelect={setSelected}
              onHover={setHovered}
            />
          </div>
        </aside>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="lg:hidden flex-none bg-white border-t border-gray-100 flex safe-area-pb">
        <button
          onClick={() => setMobileTab("filters")}
          className={clsx(
            "flex-1 flex flex-col items-center py-2 gap-0.5 text-[11px] font-medium transition-colors",
            mobileTab === "filters" ? "text-brand-500" : "text-gray-400"
          )}
        >
          <SlidersHorizontal className="w-5 h-5" />
          Filtros
        </button>
        <button
          onClick={() => setMobileTab("map")}
          className={clsx(
            "flex-1 flex flex-col items-center py-2 gap-0.5 text-[11px] font-medium transition-colors",
            mobileTab === "map" ? "text-brand-500" : "text-gray-400"
          )}
        >
          <Map className="w-5 h-5" />
          Mapa
        </button>
        <button
          onClick={() => setMobileTab("results")}
          className={clsx(
            "flex-1 flex flex-col items-center py-2 gap-0.5 text-[11px] font-medium transition-colors",
            mobileTab === "results" ? "text-brand-500" : "text-gray-400"
          )}
        >
          <List className="w-5 h-5" />
          {showRanking && !isPending ? `${schools.length} centros` : "Resultados"}
        </button>
      </nav>

      {/* Detail overlay */}
      {selected && (
        <SchoolDetail school={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
