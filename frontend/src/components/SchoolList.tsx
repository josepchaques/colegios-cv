"use client";
import type { RecommendedSchool } from "@/lib/types";
import { SchoolCard } from "./SchoolCard";

interface Props {
  schools: RecommendedSchool[];
  loading: boolean;
  selected: number | null;
  onSelect: (s: RecommendedSchool) => void;
  onHover: (id: number | null) => void;
}

export function SchoolList({ schools, loading, selected, onSelect, onHover }: Props) {
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!schools.length) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-gray-400">
          Usa el formulario para buscar colegios.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-1.5">
      {schools.map((school, index) => (
        <SchoolCard
          key={school.id}
          school={school}
          rank={index + 1}
          isSelected={school.id === selected}
          onSelect={() => onSelect(school)}
          onMouseEnter={() => onHover(school.id)}
          onMouseLeave={() => onHover(null)}
        />
      ))}
    </div>
  );
}
