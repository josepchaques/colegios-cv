"use client";
import clsx from "clsx";
import type { ScoreBreakdown as ScoreBreakdownType } from "@/lib/types";

const SCORE_FIELDS: { key: keyof ScoreBreakdownType; label: string; weight: string }[] = [
  { key: "preference_match", label: "Encaje personal", weight: "35%" },
  { key: "distance", label: "Proximidad", weight: "25%" },
  { key: "affordability", label: "Accesibilidad económica", weight: "20%" },
  { key: "objective_quality", label: "Calidad académica objetiva", weight: "15%" },
  { key: "review", label: "Opiniones familias", weight: "5%" },
];

function scoreColor(score: number) {
  if (score >= 0.75) return "bg-emerald-500";
  if (score >= 0.55) return "bg-amber-400";
  return "bg-red-400";
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={clsx("h-full rounded-full score-bar", scoreColor(score))}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-600 w-7 text-right">{pct}</span>
    </div>
  );
}

interface Props {
  scores: ScoreBreakdownType;
  explanation: Record<string, string>;
}

export function ScoreBreakdown({ scores }: Props) {
  const finalPct = Math.round(scores.final * 100);
  const color =
    finalPct >= 75 ? "text-emerald-600" : finalPct >= 55 ? "text-amber-600" : "text-red-500";

  return (
    <div>
      {/* Final score hero */}
      <div className="flex items-center gap-3 mb-4">
        <div className={clsx("text-3xl font-bold", color)}>{finalPct}</div>
        <div>
          <p className="text-xs font-medium text-gray-700">Score global</p>
          <p className="text-[10px] text-gray-400">de 100 puntos</p>
        </div>
      </div>

      {/* Breakdown */}
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Desglose del score
      </h3>
      <div className="space-y-2.5">
        {SCORE_FIELDS.map(({ key, label, weight }) => (
          <div key={key}>
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-xs text-gray-600">{label}</span>
              <span className="text-[10px] text-gray-400">peso {weight}</span>
            </div>
            <ScoreBar score={scores[key] as number} />
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-400 mt-3">
        * La calidad académica objetiva siempre tiene mayor peso que las opiniones.
        En caso de empate, desempata la calidad objetiva.
      </p>
    </div>
  );
}
