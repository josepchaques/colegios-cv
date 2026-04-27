"use client";
import { useState } from "react";
import { X, FileText, CheckCircle } from "lucide-react";
import type { RecommendedSchool } from "@/lib/types";

interface Props {
  school: RecommendedSchool;
  onClose: () => void;
}

const PERKS = [
  "Ratio alumnos/profesor real vs. media provincial",
  "Evolución de matrícula los últimos 5 años",
  "Índice de continuidad entre etapas (primaria → ESO)",
  "Actividades extraescolares y coste real",
  "Lo que otros padres opinan… y el colegio no publica",
];

export function LeadModal({ school, onClose }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setLoading(true);
    // TODO: replace with real lead submission endpoint
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 800);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-brand-500 px-6 pt-6 pb-5 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-5 h-5 opacity-80" />
            <span className="text-xs font-semibold uppercase tracking-wide opacity-80">
              Informe gratuito
            </span>
          </div>
          <h2 className="text-lg font-bold leading-snug">
            La ficha de {school.name} que el colegio no te da
          </h2>
        </div>

        <div className="px-6 py-5">
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-500" />
              <p className="font-semibold text-gray-900">¡Listo! Te lo enviamos enseguida</p>
              <p className="text-sm text-gray-500">
                Revisa tu bandeja de entrada en los próximos minutos.
              </p>
              <button
                onClick={onClose}
                className="mt-2 px-5 py-2 bg-brand-500 text-white text-sm font-semibold rounded-lg hover:bg-brand-600 transition-colors"
              >
                Cerrar
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Te enviamos un PDF con los datos que realmente importan — los que no aparecen en la web del colegio:
              </p>
              <ul className="space-y-1.5 mb-5">
                {PERKS.map((perk) => (
                  <li key={perk} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-0.5 text-brand-500 font-bold">✓</span>
                    {perk}
                  </li>
                ))}
              </ul>

              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="text"
                  placeholder="Tu nombre"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
                <input
                  type="email"
                  placeholder="Tu email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-brand-500 text-white text-sm font-semibold rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-60"
                >
                  {loading ? "Enviando…" : "Recibir informe gratis →"}
                </button>
                <p className="text-[11px] text-gray-400 text-center">
                  Sin spam. Solo este informe. Puedes darte de baja cuando quieras.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
