# Colegios CV

Recomendador personalizado de colegios para la **Comunitat Valenciana**. Combina datos oficiales de la GVA y OpenStreetMap con un algoritmo de scoring multidimensional para sugerir los centros que mejor se ajustan al perfil de cada familia.

---

## Características

- **4.026 centros reales** — cruce de OpenStreetMap + CSV oficial Dades Obertes GVA
- **Scoring personalizado** — 5 dimensiones ponderables: encaje educativo, distancia, coste, calidad académica y reseñas
- **Mapa interactivo** — marcadores en Mapbox GL con hover y selección
- **Filtros por tipo y etapa** — público/concertado/privado · infantil/primaria/ESO/bachillerato/FP
- **Explicabilidad** — razones positivas y puntos a considerar por cada colegio recomendado
- **Geocodificación** — búsqueda por dirección con Nominatim (sin API key), acotada a la CV

---

## Stack tecnológico

### Backend
| Componente | Tecnología | Versión |
|---|---|---|
| Framework API | FastAPI | 0.111 |
| Lenguaje | Python | 3.9+ |
| ORM | SQLAlchemy | 2.0 |
| Base de datos | SQLite (dev) / PostgreSQL (prod) | — |
| Álgebra vectorial | NumPy | 1.26 |
| Geocodificación | geopy | 2.4 |
| Servidor ASGI | Uvicorn | 0.29 |

### Frontend
| Componente | Tecnología | Versión |
|---|---|---|
| Framework | Next.js (App Router) | 14.2 |
| Lenguaje | TypeScript | 5.4 |
| Estilos | Tailwind CSS | 3.4 |
| Tipografía | Nunito (Google Fonts) | — |
| Mapa | Mapbox GL JS | 3.4 |
| Estado servidor | TanStack Query | 5.4 |

---

## Estructura del proyecto

```
colegios-cv/
├── backend/
│   ├── app/
│   │   ├── api/routes/       # Endpoints FastAPI
│   │   ├── core/             # Config, base de datos
│   │   ├── models/           # Modelo SQLAlchemy (School)
│   │   ├── schemas/          # Pydantic schemas
│   │   └── services/         # scorer.py + recommender.py
│   ├── data/
│   │   ├── etl_overpass.py   # ETL OpenStreetMap → SQLite
│   │   └── etl_gva.py        # ETL CSV GVA → enriquecimiento
│   ├── schools_cv.db         # Base de datos SQLite (4.026 centros)
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── app/              # Layout, página principal, estilos globales
    │   ├── components/       # FilterPanel, MapView, SchoolList, SchoolDetail…
    │   └── lib/              # API client, tipos TypeScript
    ├── public/               # Logo, favicons
    └── next.config.js
```

---

## Instalación local

### Requisitos
- Python 3.9+
- Node.js 18+
- Token de [Mapbox](https://account.mapbox.com) (gratuito)

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

La base de datos SQLite (`schools_cv.db`) ya incluye los 4.026 centros. Si quieres regenerarla desde cero:

```bash
# 1. Importar colegios de OpenStreetMap (~2.172 centros)
python3 data/etl_overpass.py

# 2. Enriquecer con CSV oficial GVA (+1.854 centros nuevos)
python3 data/etl_gva.py
```

### Frontend

```bash
cd frontend
cp .env.example .env.local
# Edita .env.local y añade tu token de Mapbox
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

---

## Variables de entorno

### Frontend (`.env.local`)
```env
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Backend (`.env`, opcional)
```env
DEBUG=true                          # false en producción (desactiva /docs)
ALLOWED_ORIGINS=http://localhost:3000  # En prod: https://tudominio.com
DATABASE_URL=sqlite:///./schools_cv.db
```

---

## API

La documentación interactiva está disponible en `http://localhost:8000/docs` (solo cuando `DEBUG=true`).

### `POST /api/v1/recommend`

```json
{
  "lat": 39.4699,
  "lon": -0.3763,
  "monthly_salary": 2500,
  "max_distance_km": 10,
  "school_types": ["public", "concertado"],
  "school_levels": ["primaria", "secundaria"],
  "preferences": {
    "stem": 0.8,
    "english": 0.6,
    "valencian": 0.4
  },
  "weights": {
    "user_fit": 0.35,
    "distance": 0.25,
    "cost": 0.20,
    "quality": 0.15,
    "reviews": 0.05
  },
  "limit": 20
}
```

**Respuesta:**
```json
{
  "results": [
    {
      "id": 142,
      "name": "CEIP Mediterrani",
      "school_type": "public",
      "levels": ["infantil", "primaria"],
      "lat": 39.481,
      "lon": -0.362,
      "monthly_fee_avg": 20,
      "scores": {
        "final": 0.83,
        "preference_match": 0.91,
        "distance": 0.87,
        "affordability": 1.0,
        "objective_quality": 0.71,
        "review": 0.72
      },
      "explanation": {
        "preference_match": "Muy alto encaje con tus preferencias educativas",
        "distance": "A 1.8 km (6 min en coche)",
        "cost": "Centro público — coste prácticamente nulo"
      },
      "weaknesses": {}
    }
  ],
  "total": 4026
}
```

---

## Algoritmo de scoring

```
final_score = Σ (wᵢ · scoreᵢ)   donde Σwᵢ = 1
```

| Componente | Peso por defecto | Método |
|---|---|---|
| `preference_match` | 35% | Cosine similarity (vector 10D) |
| `distance` | 25% | Decaimiento logístico inverso |
| `affordability` | 20% | Umbral 15% del salario neto |
| `objective_quality` | 15% | Proxy académico + infraestructura |
| `review` | 5% | Bayesian smoothing (C=10, m=3.8) |

En caso de empate (diferencia < 0.03), desempata `objective_quality`.

Documentación completa del algoritmo en [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Fuentes de datos

| Fuente | Registros | Licencia |
|---|---|---|
| [OpenStreetMap — Overpass API](https://overpass-api.de) | ~2.172 centros | ODbL |
| [Dades Obertes GVA](https://dadesobertes.gva.es) — dataset `edu-centros` | 3.632 centros válidos | CC BY 4.0 |
| **Total combinado** | **4.026 centros** | — |

---

## Despliegue (producción)

Stack recomendado gratuito: **Vercel** (frontend) + **Render** (backend).

Ver guía detallada en [ARCHITECTURE.md — Despliegue](./ARCHITECTURE.md).

Variables clave para producción:
- `DEBUG=false` — desactiva Swagger UI
- `ALLOWED_ORIGINS=https://tuapp.vercel.app`
- `NEXT_PUBLIC_API_URL=https://tu-backend.onrender.com`

---

## Roadmap

- [ ] Integración Google Places API para ratings reales
- [ ] Índice de renta por zona (microdatos INE)
- [ ] Resultados PAU/EvAU por centro (Ministerio de Educación)
- [ ] Learning to Rank con feedback implícito de clicks
- [ ] Extensión a toda España

---

## Licencia

MIT — los datos de los centros son públicos (ODbL + CC BY 4.0).
