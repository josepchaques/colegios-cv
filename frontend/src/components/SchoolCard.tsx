"use client";
import { useState } from "react";
import type { RecommendedSchool } from "@/lib/types";
import clsx from "clsx";
import { Star, MapPin, FileText } from "lucide-react";
import { LeadModal } from "./LeadModal";

const TYPE_COLORS: Record<string, string> = {
  public: "bg-emerald-50 text-emerald-700",
  concertado: "bg-blue-50 text-blue-700",
  private: "bg-purple-50 text-purple-700",
};

const TYPE_LABELS: Record<string, string> = {
  public: "Público",
  concertado: "Concertado",
  private: "Privado",
};

function ScoreRing({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 75 ? "#22c55e" : pct >= 55 ? "#f59e0b" : "#ef4444";
  const radius = 14;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;

  return (
    <div className="relative w-10 h-10 flex-none">
      <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-gray-700">
        {pct}
      </span>
    </div>
  );
}

interface Props {
  school: RecommendedSchool;
  rank: number;
  isSelected: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function SchoolCard({
  school,
  rank,
  isSelected,
  onSelect,
  onMouseEnter,
  onMouseLeave,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  const costStr =
    school.monthly_fee_avg <= 30
      ? "Gratuito"
      : `~${Math.round(school.monthly_fee_avg)}€/mes`;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className={clsx(
          "w-full text-left p-3 rounded-xl border transition-all bg-white cursor-pointer",
          isSelected
            ? "border-brand-500 bg-brand-50 shadow-sm"
            : "border-gray-100 hover:border-brand-200 hover:shadow-sm"
        )}
        onClick={onSelect}
        onKeyDown={(e) => e.key === "Enter" && onSelect()}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div className="flex items-start gap-2.5">
          {/* Rank */}
          {rank <= 3 ? (
            <span className="flex-none w-4 mt-0.5 text-center text-sm leading-none">
              {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}
            </span>
          ) : (
            <span className="flex-none text-xs font-bold text-gray-300 w-4 mt-0.5">
              {rank}
            </span>
          )}

          {/* Score ring */}
          <ScoreRing score={school.scores.final} />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
              {school.name}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span
                className={clsx(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded",
                  TYPE_COLORS[school.school_type] ?? "bg-gray-100 text-gray-600"
                )}
              >
                {TYPE_LABELS[school.school_type] ?? school.school_type}
              </span>
              {school.district && (
                <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                  <MapPin className="w-2.5 h-2.5" />
                  {school.district}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {school.google_rating > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-amber-500">
                  <Star className="w-2.5 h-2.5 fill-amber-400 stroke-amber-400" />
                  {school.google_rating.toFixed(1)}
                  <span className="text-gray-400">({school.google_review_count})</span>
                </span>
              )}
              <span className="text-[10px] text-gray-400">{costStr}</span>
            </div>

            {/* CTA */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setModalOpen(true);
              }}
              className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-brand-500 hover:text-brand-600 transition-colors"
            >
              <FileText className="w-3 h-3" />
              Informe gratuito PDF →
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <LeadModal school={school} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
