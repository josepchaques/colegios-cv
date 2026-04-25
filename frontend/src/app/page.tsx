"use client";
import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { fetchRecommendations } from "@/lib/api";
import type { RecommendRequest, RecommendedSchool } from "@/lib/types";
import { FilterPanel } from "@/components/FilterPanel";
import { SchoolList } from "@/components/SchoolList";
import { MapView } from "@/components/MapView";
import { SchoolDetail } from "@/components/SchoolDetail";

const DEFAULT_REQUEST: RecommendRequest = {
  lat: 39.4699,
  lon: -0.3763,
  monthly_salary: 2000,
  school_types: [],
  preferences: {},
  max_distance_km: 10,
  limit: 20,
};

export default function Home() {
  const [req, setReq] = useState<RecommendRequest>(DEFAULT_REQUEST);
  const [selected, setSelected] = useState<RecommendedSchool | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

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
      <header className="flex-none bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4 z-10">
        <div className="flex items-center gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.jpeg"
            alt="Colegios CV"
            className="w-20 h-20 rounded-2xl object-cover shadow-sm"
          />
          <div className="flex flex-col">
            <span className="font-bold text-gray-900 text-lg leading-tight">Colegios CV</span>
            <span className="text-xs text-gray-400 hidden sm:block">Comunitat Valenciana</span>
          </div>
        </div>
        <span className="text-gray-200 select-none">|</span>
        <span className="text-gray-400 text-sm hidden sm:block">
          Recomendación personalizada de colegios
        </span>
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

        {/* CENTER — Mapa */}
        <main className="flex-1 relative min-w-0">
          <MapView
            schools={schools}
            userLat={req.lat}
            userLon={req.lon}
            selected={selected}
            hovered={hovered}
            onSelectSchool={setSelected}
          />
          {!showRanking && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-white/90 backdrop-blur-sm rounded-xl px-5 py-4 shadow-sm text-center">
                <p className="text-sm font-medium text-gray-600">Configura tu búsqueda y pulsa</p>
                <p className="text-xs text-gray-400 mt-0.5">«Buscar colegios» para ver resultados</p>
              </div>
            </div>
          )}
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
