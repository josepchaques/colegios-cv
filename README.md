# Colegios CV

Recomendador personalizado de colegios para la **Comunitat Valenciana**. Combina datos oficiales de la GVA y OpenStreetMap con un algoritmo de scoring multidimensional para sugerir los centros que mejor se ajustan al perfil de cada familia.

---

## Características

- **4.026 centros reales** — cruce de OpenStreetMap + CSV oficial Dades Obertes GVA
- **Scoring personalizado** — 5 dimensiones ponderables: encaje educativo, distancia, coste, calidad académica y reseñas
- **Mapa interactivo** — marcadores en Mapbox GL con hover y selección
- **Vista burbuja** — visualización Circle Pack con D3.js
- **Filtros por tipo y etapa** — público/concertado/privado · infantil/primaria/ESO/bachillerato/FP (filtro AND)
- **Explicabilidad** — razones positivas y puntos a considerar por cada colegio recomendado
- **Geocodificación** — búsqueda por dirección con Mapbox Geocoding, acotada a la CV
- **Diseño responsive** — funciona en móvil, tablet y escritorio
- **Captura de leads** — popup PDF desde la card de cada colegio

---

## Stack tecnológico

### Backend
| Componente | Tecnología | Versión |
|---|---|---|
| Framework API | FastAPI | 0.111 |
| Lenguaje | Python | 3.9+ |
| ORM | SQLAlchemy | 2.0 |
| Base de datos | PostgreSQL | 16 |
| Driver PostgreSQL | psycopg2-binary | 2.9 |
| Álgebra vectorial | NumPy | 1.26 |
| Geocodificación | geopy | 2.4 |
| Scheduler | APScheduler | 3.10 |
| Servidor ASGI | Uvicorn | 0.29 |

### Frontend
| Componente | Tecnología | Versión |
|---|---|---|
| Framework | Next.js (App Router) | 14.2 |
| Lenguaje | TypeScript | 5.4 |
| Estilos | Tailwind CSS | 3.4 |
| Mapa | Mapbox GL JS | 3.4 |
| Visualización | D3.js | 7.9 |
| Estado servidor | TanStack Query | 5.4 |
| Geocodificación UI | Mapbox Geocoding API | — |

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
│   ├── app/
│   │   ├── scheduler.py      # APScheduler — jobs automáticos de ETL
│   │   └── ...
│   ├── data/
│   │   ├── etl_overpass.py       # ETL OpenStreetMap → PostgreSQL
│   │   ├── etl_gva.py            # ETL CSV GVA → enriquecimiento
│   │   ├── etl_levels.py         # ETL WFS ICV/GVA → etapas educativas oficiales
│   │   └── migrate_sqlite_to_pg.py  # Migración one-shot SQLite → PostgreSQL
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── app/              # Layout, página principal, estilos globales
    │   ├── components/       # FilterPanel, MapView, SchoolList, SchoolDetail, SchoolCard,
    │   │                     # CirclePackView, RecommendingLoader, LeadModal, Logo
    │   └── lib/              # API client, tipos TypeScript
    ├── public/               # Favicons, robots.txt
    └── next.config.js        # CSP headers, env vars
```

---

## Instalación local

### Requisitos
- Docker Desktop
- Token de [Mapbox](https://account.mapbox.com) (gratuito)

### Levantar con Docker (recomendado)

```bash
cp .env.example .env
# Edita .env y añade tu token de Mapbox
docker compose up --build
```

Abre [http://localhost:3000](http://localhost:3000). La API estará en [http://localhost:8000](http://localhost:8000).

Los ETLs se ejecutan automáticamente vía APScheduler (OSM mensual, GVA trimestral). Para lanzarlos manualmente dentro del contenedor:

```bash
docker compose exec backend python data/etl_overpass.py
docker compose exec backend python data/etl_gva.py
docker compose exec backend python data/etl_levels.py
```

### Sin Docker (requiere PostgreSQL local)

```bash
# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/schools_cv uvicorn app.main:app --reload --port 8000

# Frontend (otra terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

---

## Variables de entorno

### Raíz del proyecto (`.env`)
```env
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here
DATABASE_URL=postgresql://postgres:postgres@db:5432/schools_cv
REDIS_URL=redis://redis:6379/0
```

### Backend (variables adicionales opcionales)
```env
DEBUG=true                             # false en producción (desactiva /docs)
ALLOWED_ORIGINS=http://localhost:3000  # En prod: https://tudominio.com
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

El ranking ordena por `final_score` directo. En caso de empate exacto desempata `google_review_count` (más reseñas = score más fiable estadísticamente).

Documentación completa del algoritmo en [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Fuentes de datos

| Fuente | Registros | Uso | Licencia |
|---|---|---|---|
| [OpenStreetMap — Overpass API](https://overpass-api.de) | ~2.172 centros | Coordenadas, nombre, tipo | ODbL |
| [Dades Obertes GVA](https://dadesobertes.gva.es) — `edu-centros` | 3.632 centros válidos | Datos oficiales, enriquecimiento | CC BY 4.0 |
| [WFS ICV/GVA](https://terramapas.icv.gva.es/12_Centros_wfs) | ~2.781 centros | **Etapas educativas reales** | CC BY 4.0 |
| **Total combinado** | **4.026 centros** | — | — |

---

## Despliegue (producción)

Stack: **Vercel** (frontend) + **Render** (backend + PostgreSQL).

**Frontend (Vercel)**
- Root Directory: `frontend`
- Variables de entorno:
  ```
  NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx
  NEXT_PUBLIC_API_URL=https://tu-backend.onrender.com
  ```

**Backend (Render)**
- Variables de entorno:
  ```
  DATABASE_URL=postgresql://...@dpg-xxx-a/schools_cv   # Internal URL de Render
  ALLOWED_ORIGINS=https://tu-app.vercel.app
  DEBUG=false
  ```
- Migración inicial de datos: `python data/migrate_sqlite_to_pg.py`

> En el plan gratuito de Render el servicio duerme tras 15 min de inactividad — la primera petición puede tardar hasta 60 s (cold start). El frontend tiene un timeout de 60 s para tolerarlo.

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
