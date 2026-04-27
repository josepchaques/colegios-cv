"use client";
import { useState, useCallback } from "react";
import clsx from "clsx";
import { useMutation } from "@tanstack/react-query";
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

export default function Home() {
  const [req, setReq] = useState<RecommendRequest>(DEFAULT_REQUEST);
  const [selected, setSelected] = useState<RecommendedSchool | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("map");

  const { data, mutate, isPending } = useMutation({
    mutationFn: fetchRecommendations,
  });

  const handleSearch = useCallback(
    (newReq: RecommendRequest) => {
      setReq(newReq);
      setSelected(null);
      mutate(newReq);
    },
    [mutate]
  );

  const schools = data?.results ?? [];
  const showRanking = schools.length > 0 || isPending;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="flex-none bg-white border-b border-gray-100 px-6 py-2 flex items-center gap-4 z-10">
        <Logo className="h-10 w-auto" />
        {data && (
          <span className="ml-auto text-xs text-gray-400">
            {data.total} centros encontrados
          </span>
        )}
      </header>

      {/* Body: filters | map | ranking */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — Filtros */}
        <aside className="flex-none w-72 bg-white border-r border-gray-100 overflow-y-auto">
          <FilterPanel initial={req} onSearch={handleSearch} loading={isPending} />
        </aside>

        {/* CENTER — Mapa / Circle Pack */}
        <main className="flex-1 relative min-w-0 flex flex-col">
          {/* View toggle */}
          {showRanking && (
            <div className="flex-none flex gap-1 absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur-sm rounded-xl p-1 shadow-sm border border-gray-100">
              <button
                onClick={() => setViewMode("map")}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  viewMode === "map"
                    ? "bg-brand-500 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                🗺️ Mapa
              </button>
              <button
                onClick={() => setViewMode("circles")}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  viewMode === "circles"
                    ? "bg-brand-500 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                🫧 Burbujas
              </button>
            </div>
          )}

          <div className="flex-1 relative">
            {/* Loading overlay */}
            {isPending && <RecommendingLoader />}

            {/* Map — always mounted to preserve state, hidden when not active */}
            <div className={clsx("absolute inset-0", viewMode !== "map" && "invisible")}>
              <MapView
                schools={schools}
                userLat={req.lat}
                userLon={req.lon}
                selected={selected}
                hovered={hovered}
                onSelectSchool={setSelected}
              />
            </div>

            {/* Circle pack */}
            {viewMode === "circles" && (
              <div className="absolute inset-0">
                <CirclePackView
                  schools={schools}
                  selected={selected}
                  onSelectSchool={setSelected}
                />
              </div>
            )}

            {!showRanking && (
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
        {showRanking && (
          <aside className="flex-none w-80 bg-white border-l border-gray-100 flex flex-col overflow-hidden">
            <div className="flex-none px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">
                {isPending ? "Buscando…" : `${schools.length} colegios recomendados`}
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
        )}
      </div>

      {/* Detail overlay */}
      {selected && (
        <SchoolDetail school={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
