"use client";

export function RecommendingLoader() {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        {/* Spinner */}
        <div className="relative w-12 h-12">
          <svg className="w-12 h-12 animate-spin" viewBox="0 0 48 48" fill="none">
            <circle
              cx="24" cy="24" r="20"
              stroke="#e5e7eb"
              strokeWidth="3.5"
            />
            <circle
              cx="24" cy="24" r="20"
              stroke="#3b5bdb"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray="30 96"
            />
          </svg>
        </div>

        {/* Text */}
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-800 tracking-tight">
            Ejecutando modelo de recomendación…
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Normalizando variables y aplicando scoring multicriterio
          </p>
        </div>
      </div>
    </div>
  );
}
