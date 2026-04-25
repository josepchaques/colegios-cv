"use client";
import type { RecommendedSchool } from "@/lib/types";
import { X, Star, Globe, MapPin, ChevronRight, AlertTriangle } from "lucide-react";
import { ScoreBreakdown } from "./ScoreBreakdown";
import clsx from "clsx";

const TYPE_LABELS: Record<string, string> = {
  public: "Público",
  concertado: "Concertado",
  private: "Privado",
};

const LEVEL_LABELS: Record<string, string> = {
  infantil: "Inf",
  primaria: "Pri",
  secundaria: "ESO",
  bachillerato: "Bach",
  FP: "FP",
};

interface Props {
  school: RecommendedSchool;
  onClose: () => void;
}

export function SchoolDetail({ school, onClose }: Props) {
  const costStr =
    school.monthly_fee_avg <= 30
      ? "Gratuito / casi gratuito"
      : `${school.monthly_fee_min}–${school.monthly_fee_max}€/mes (media ~${Math.round(school.monthly_fee_avg)}€)`;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl z-50 flex flex-col overflow-hidden border-l border-gray-100">
      {/* Header */}
      <div className="flex-none p-5 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-900 leading-tight">
              {school.name}
            </h2>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="text-xs text-gray-500 px-1.5 py-0.5 bg-gray-100 rounded">
                {TYPE_LABELS[school.school_type] ?? school.school_type}
              </span>
              {school.methodology && school.methodology !== "tradicional" && (
                <span className="text-xs text-brand-600 px-1.5 py-0.5 bg-brand-50 rounded capitalize">
                  {school.methodology}
                </span>
              )}
              {school.levels.map((l) => (
                <span key={l} className="text-xs text-gray-400 px-1 py-0.5 bg-gray-50 rounded border border-gray-100">
                  {LEVEL_LABELS[l] ?? l}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-none p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Meta */}
        <div className="mt-3 space-y-1.5">
          {school.address && (
            <div className="flex items-start gap-1.5 text-xs text-gray-500">
              <MapPin className="w-3.5 h-3.5 flex-none mt-0.5 text-gray-400" />
              <span>{school.address}, {school.city}</span>
            </div>
          )}
          {school.google_rating > 0 && (
            <div className="flex items-center gap-1 text-xs">
              <Star className="w-3.5 h-3.5 fill-amber-400 stroke-amber-400" />
              <span className="font-medium text-gray-700">{school.google_rating.toFixed(1)}</span>
              <span className="text-gray-400">({school.google_review_count} reseñas Google)</span>
            </div>
          )}
          <div className="text-xs text-gray-500">
            <span className="font-medium text-gray-700">Coste: </span>{costStr}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Score breakdown */}
        <ScoreBreakdown scores={school.scores} explanation={school.explanation} />

        {/* Why this school */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            ¿Por qué este colegio?
          </h3>
          <ul className="space-y-2">
            {Object.entries(school.explanation).map(([key, text]) => (
              <li key={key} className="flex items-start gap-2">
                <ChevronRight className="w-3.5 h-3.5 text-brand-500 flex-none mt-0.5" />
                <span className="text-sm text-gray-600">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Weaknesses */}
        {Object.keys(school.weaknesses).length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Puntos a considerar
            </h3>
            <ul className="space-y-2">
              {Object.entries(school.weaknesses).map(([key, text]) => (
                <li key={key} className="flex items-start gap-2 bg-amber-50 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-none mt-0.5" />
                  <span className="text-sm text-amber-800">{text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Activities */}
        {school.extra_activities.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Actividades
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {school.extra_activities.map((a) => (
                <span
                  key={a}
                  className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Links */}
        <div className="flex gap-2 pt-1">
          {school.website && (
            <a
              href={school.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium"
            >
              <Globe className="w-3.5 h-3.5" /> Web oficial
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
