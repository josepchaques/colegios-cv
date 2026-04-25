"use client";
import { useState, useEffect, useRef } from "react";
import { Search, MapPin, SlidersHorizontal, ChevronDown, ChevronUp, Loader2, CheckCircle2 } from "lucide-react";
import type { RecommendRequest } from "@/lib/types";
import clsx from "clsx";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
// Bounding box Comunitat Valenciana [minLon, minLat, maxLon, maxLat]
const CV_BBOX = "-1.5,38.5,1.0,40.5";

interface Suggestion {
  label: string;
  lat: number;
  lon: number;
}

async function fetchSuggestions(query: string): Promise<Suggestion[]> {
  if (!query.trim() || query.length < 3) return [];
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
      `?access_token=${MAPBOX_TOKEN}` +
      `&country=es` +
      `&bbox=${CV_BBOX}` +
      `&language=es` +
      `&limit=5` +
      `&types=place,locality,neighborhood,address,poi`;
    const res  = await fetch(url);
    const data = await res.json();
    return (data.features ?? []).map((f: any) => ({
      label: f.place_name,
      lat:   f.center[1],
      lon:   f.center[0],
    }));
  } catch {
    return [];
  }
}

const TYPE_LABELS: Record<string, string> = {
  public:     "Público",
  concertado: "Concertado",
  private:    "Privado",
};

const LEVEL_LABELS: { key: string; label: string }[] = [
  { key: "infantil",     label: "Infantil" },
  { key: "primaria",     label: "Primaria" },
  { key: "secundaria",   label: "Secundaria" },
  { key: "bachillerato", label: "Bachillerato" },
  { key: "FP",           label: "FP" },
];

const PREFS: { key: string; label: string; emoji: string }[] = [
  { key: "stem",        label: "STEM / Tecnología", emoji: "🔬" },
  { key: "sports",      label: "Deportes",          emoji: "⚽" },
  { key: "arts",        label: "Artes",             emoji: "🎨" },
  { key: "english",     label: "Inglés",            emoji: "🇬🇧" },
  { key: "valencian",   label: "Valenciano",        emoji: "🟡" },
  { key: "bilingual",   label: "Bilingüe",          emoji: "🌍" },
  { key: "montessori",  label: "Montessori",        emoji: "🌱" },
  { key: "traditional", label: "Metodología trad.", emoji: "📚" },
  { key: "religion",    label: "Religioso",         emoji: "✝️" },
  { key: "inclusion",   label: "Inclusión",         emoji: "🤝" },
];

const WEIGHTS: { key: string; label: string }[] = [
  { key: "user_fit",  label: "Encaje personal"    },
  { key: "distance",  label: "Proximidad"         },
  { key: "cost",      label: "Coste"              },
  { key: "quality",   label: "Calidad académica"  },
  { key: "reviews",   label: "Opiniones familias" },
];

interface Props {
  initial: RecommendRequest;
  onSearch: (req: RecommendRequest) => void;
  loading: boolean;
}

export function FilterPanel({ initial, onSearch, loading }: Props) {
  const [address,      setAddress]      = useState("Valencia, España");
  const [suggestions,  setSuggestions]  = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected,     setSelected]     = useState<Suggestion | null>(null);
  const [coords,       setCoords]       = useState({ lat: initial.lat, lon: initial.lon });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef  = useRef<HTMLDivElement>(null);

  const [salary,      setSalary]      = useState(String(initial.monthly_salary));
  const [distance,    setDistance]    = useState(String(initial.max_distance_km));
  const [types,       setTypes]       = useState<string[]>([]);
  const [levels,      setLevels]      = useState<string[]>([]);
  const [prefs,       setPrefs]       = useState<Record<string, number>>({});
  const [weights,     setWeights]     = useState({ user_fit:35, distance:25, cost:20, quality:15, reviews:5 });
  const [showWeights, setShowWeights] = useState(false);

  // Debounced autocomplete
  useEffect(() => {
    if (selected) return; // don't re-fetch after a selection
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const results = await fetchSuggestions(address);
      setSuggestions(results);
      setShowDropdown(results.length > 0);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [address]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleAddressChange = (val: string) => {
    setAddress(val);
    setSelected(null); // clear selection when user types again
  };

  const handleSelect = (s: Suggestion) => {
    setAddress(s.label.split(",").slice(0, 2).join(",").trim());
    setCoords({ lat: s.lat, lon: s.lon });
    setSelected(s);
    setShowDropdown(false);
  };

  const toggleType  = (t: string) =>
    setTypes(prev  => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  const toggleLevel = (l: string) =>
    setLevels(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);

  const handleSubmit = () => {
    onSearch({
      lat:            coords.lat,
      lon:            coords.lon,
      monthly_salary: parseFloat(salary) || 2000,
      school_types:   types.length  ? types  : undefined,
      school_levels:  levels.length ? levels : undefined,
      preferences:    prefs,
      weights: {
        user_fit: weights.user_fit / 100,
        distance: weights.distance / 100,
        cost:     weights.cost     / 100,
        quality:  weights.quality  / 100,
        reviews:  weights.reviews  / 100,
      },
      max_distance_km: parseFloat(distance) || 10,
      limit: 20,
    });
  };

  return (
    <div className="p-4 space-y-5">

      {/* Ubicación */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Tu ubicación
        </h3>
        <div className="relative" ref={wrapperRef}>
          <MapPin className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none z-10" />
          {selected && (
            <CheckCircle2 className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-emerald-500 pointer-events-none z-10" />
          )}
          <input
            className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={address}
            onChange={e => handleAddressChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && !selected && setShowDropdown(true)}
            onKeyDown={e => {
              if (e.key === "Escape") setShowDropdown(false);
              if (e.key === "Enter") { setShowDropdown(false); handleSubmit(); }
            }}
            placeholder="Ej: La Cañada, Paterna"
            autoComplete="off"
          />

          {/* Dropdown */}
          {showDropdown && (
            <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
              {suggestions.map((s, i) => (
                <li key={i}>
                  <button
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-brand-50 hover:text-brand-700 flex items-start gap-2 transition-colors"
                    onMouseDown={e => { e.preventDefault(); handleSelect(s); }}
                  >
                    <MapPin className="w-3 h-3 flex-none mt-0.5 text-gray-400" />
                    <span className="leading-snug">{s.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {selected && (
          <p className="text-[10px] text-emerald-600 mt-1 truncate">
            {selected.lat.toFixed(4)}, {selected.lon.toFixed(4)}
          </p>
        )}
      </div>

      {/* Datos básicos */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Datos básicos
        </h3>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Salario neto mensual (€)
          </label>
          <input
            type="number"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={salary}
            onChange={e => setSalary(e.target.value)}
            min={500} step={100}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Radio máximo (km)
          </label>
          <input
            type="number"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={distance}
            onChange={e => setDistance(e.target.value)}
            min={1} max={50}
          />
        </div>
      </div>

      {/* Tipo de centro */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Tipo de centro
        </h3>
        <div className="flex gap-1.5">
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => toggleType(key)}
              className={clsx(
                "flex-1 text-xs py-1.5 rounded-lg border transition-all font-medium",
                types.includes(key)
                  ? "bg-brand-500 text-white border-brand-500"
                  : "bg-white text-gray-600 border-gray-200 hover:border-brand-400"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-1">Sin selección = todos los tipos</p>
      </div>

      {/* Etapa educativa */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Etapa educativa
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {LEVEL_LABELS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => toggleLevel(key)}
              className={clsx(
                "text-xs px-2.5 py-1.5 rounded-lg border transition-all font-medium",
                levels.includes(key)
                  ? "bg-brand-500 text-white border-brand-500"
                  : "bg-white text-gray-600 border-gray-200 hover:border-brand-400"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-1">Sin selección = todas las etapas</p>
      </div>

      {/* Prioridades educativas */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
          Prioridades educativas
        </h3>
        <p className="text-[10px] text-gray-400 mb-3">
          Mueve a la derecha lo que más valoras.
        </p>
        <div className="space-y-3">
          {PREFS.map(({ key, label, emoji }) => {
            const val = prefs[key] ?? 0;
            return (
              <div key={key}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-700 font-medium">
                    {emoji} {label}
                  </span>
                  <span className={clsx(
                    "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                    val === 0
                      ? "text-gray-400 bg-gray-100"
                      : val < 0.5
                      ? "text-amber-600 bg-amber-50"
                      : "text-brand-600 bg-brand-50"
                  )}>
                    {val === 0 ? "—" : val < 0.4 ? "Baja" : val < 0.7 ? "Media" : "Alta"}
                  </span>
                </div>
                <input
                  type="range" min={0} max={1} step={0.1}
                  value={val}
                  onChange={e =>
                    setPrefs(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))
                  }
                  className="w-full h-1.5 rounded-full accent-brand-500 cursor-pointer"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Pesos avanzados */}
      <div>
        <button
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 font-medium"
          onClick={() => setShowWeights(v => !v)}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Ajustar pesos del score
          {showWeights ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {showWeights && (
          <div className="mt-3 space-y-3 p-3 bg-gray-50 rounded-lg">
            {WEIGHTS.map(({ key, label }) => (
              <div key={key}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-gray-600">{label}</span>
                  <span className="text-xs font-semibold text-gray-700">
                    {weights[key as keyof typeof weights]}%
                  </span>
                </div>
                <input
                  type="range" min={0} max={100}
                  value={weights[key as keyof typeof weights]}
                  onChange={e =>
                    setWeights(prev => ({ ...prev, [key]: parseInt(e.target.value) }))
                  }
                  className="w-full h-1.5 accent-brand-500 cursor-pointer"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className={clsx(
          "w-full py-2.5 text-sm font-semibold rounded-lg transition-all",
          "flex items-center justify-center gap-2",
          loading
            ? "bg-brand-300 text-white cursor-wait"
            : "bg-brand-500 text-white hover:bg-brand-600 shadow-sm hover:shadow"
        )}
      >
        {loading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Buscando…</>
          : <><Search className="w-4 h-4" /> Buscar colegios</>
        }
      </button>
    </div>
  );
}
