# Colegios CV — Arquitectura y documentación técnica

## Stack tecnológico

### Backend

| Componente | Tecnología | Versión | Rol |
|---|---|---|---|
| Framework API | FastAPI | 0.111 | REST API, validación automática, OpenAPI |
| Lenguaje | Python | 3.9+ | Lógica de negocio y scoring |
| ORM | SQLAlchemy | 2.0 | Modelo de datos y queries |
| Base de datos | PostgreSQL | 16 | Almacenamiento de centros |
| Driver | psycopg2-binary | 2.9 | Adaptador SQLAlchemy → PostgreSQL |
| Caché | Redis | 7 | Caché de respuestas (producción) |
| Scheduler | APScheduler | 3.10 | Ejecución automática de ETLs (background thread) |
| Geocodificación distancias | geopy | 2.4 | Cálculo Haversine lat/lon → km |
| Álgebra vectorial | NumPy | 1.26 | Cosine similarity para preferencias |
| Servidor ASGI | Uvicorn | 0.29 | Servidor de producción |

### Frontend

| Componente | Tecnología | Versión | Rol |
|---|---|---|---|
| Framework | Next.js (App Router) | 14.2 | SSR / CSR híbrido, responsive |
| Lenguaje | TypeScript | 5.4 | Type safety en cliente |
| Estilos | Tailwind CSS | 3.4 | Utility-first CSS, breakpoints lg/md/mobile |
| Mapa | Mapbox GL JS | 3.4 | Mapa interactivo con marcadores |
| Visualización | D3.js | 7.9 | Vista Circle Pack (burbujas por score) |
| Estado servidor | TanStack Query | 5.4 | Caché y mutaciones API |
| Geocodificación UI | Mapbox Geocoding API | — | Dirección → coordenadas, acotada a CV |

### Infraestructura

| Componente | Tecnología |
|---|---|
| Contenedores | Docker + Docker Compose |
| Frontend (producción) | Vercel |
| Backend (producción) | Render |
| Base de datos (producción) | Render PostgreSQL |

---

## Fuentes de datos

### 1. OpenStreetMap — Overpass API
- **URL:** `https://overpass-api.de/api/interpreter`
- **Cobertura:** Todos los nodos/ways/relations con `amenity=school` en el bounding box de la CV (37.8°N–41.0°N, 1.6°W–0.8°E)
- **Datos obtenidos:** nombre, coordenadas (lat/lon), dirección parcial, tags de tipo y metodología
- **Registros importados:** ~2.172 centros
- **Actualización:** automática vía APScheduler — día 1 de cada mes a las 03:00
- **Ejecución manual:** `python data/etl_overpass.py`
- **Licencia:** ODbL (Open Database Licence)

### 3. WFS ICV/GVA — Etapas educativas oficiales

- **URL:** `https://terramapas.icv.gva.es/12_Centros_wfs`
- **Capas utilizadas:**

| Capa WFS | Etapas asignadas |
|---|---|
| `CentrosDocentesNivel.EducacionInfantil` | `infantil` |
| `CentrosDocentesNivel.EducacionPrimaria` | `infantil`, `primaria` |
| `CentrosDocentesNivel.EducacionSecundariaBachillerato` | `secundaria`, `bachillerato` (refinado por `dgenerica_cas`) |
| `CentrosDocentesNivel.FormacionProfesional` | `FP` |

- **Cruce:** por `codcen` (código oficial de centro) → campo `code` en BD con prefijo `gva_`
- **Cobertura:** ~2.781 centros con código GVA en la CV
- **Registros actualizados en primera carga:** 751 centros
- **Actualización:** automática vía APScheduler — día 1 de enero, abril, julio y octubre a las 05:00 (tras el ETL de la GVA)
- **Ejecución manual:** `python data/etl_levels.py`
- **Nota:** los centros de origen OSM puro (sin código GVA) mantienen inferencia de etapas por nombre

### 2. Dades Obertes GVA — CSV oficial
- **URL:** `https://dadesobertes.gva.es` → dataset `edu-centros`
- **Endpoint:** CSV público, sin autenticación
- **Datos obtenidos:** código oficial del centro, nombre normalizado, tipo de régimen (público/concertado/privado), dirección completa, localidad, comarca, código postal, teléfono, web oficial, coordenadas oficiales
- **Registros:** 3.685 centros en el CSV (3.632 válidos con coordenadas en CV)
- **Acción ETL:** enriquece los registros OSM existentes por proximidad geográfica y añade centros no presentes en OSM
- **Resultado combinado:** **4.026 centros reales**
- **Actualización:** automática vía APScheduler — día 1 de enero, abril, julio y octubre a las 04:00
- **Ejecución manual:** `python data/etl_gva.py`
- **Licencia:** Creative Commons BY 4.0

### Scheduler de actualización automática

El backend arranca APScheduler como background thread al iniciar la aplicación (`app/scheduler.py`). Los jobs corren en segundo plano sin bloquear la API y registran su actividad en los logs del servidor.

| Job | Trigger | Script |
|---|---|---|
| `etl_osm` | Día 1 de cada mes, 03:00 | `data/etl_overpass.py` |
| `etl_gva` | Día 1 de ene/abr/jul/oct, 04:00 | `data/etl_gva.py` |
| `etl_levels` | Día 1 de ene/abr/jul/oct, 05:00 | `data/etl_levels.py` |

Si un ETL falla (timeout, fuente no disponible), el error queda logueado y el scheduler continúa funcionando con normalidad.

### Campos enriquecidos por cruce OSM + GVA

| Campo | Fuente primaria | Fuente secundaria |
|---|---|---|
| Nombre | GVA (oficial) | OSM |
| Coordenadas | GVA | OSM |
| Tipo de centro | GVA (régimen oficial) | Inferido por nombre |
| Ciudad / comarca | GVA | — |
| Dirección | GVA | OSM addr:* |
| Teléfono | GVA | OSM contact:phone |
| Web | GVA | OSM website |
| Features educativas (STEM, idiomas…) | Inferido por nombre + tipo | — |
| Google rating / reseñas | — (roadmap) | Google Places API |

---

## Algoritmo de scoring y ranking

### Principio fundamental

> **El sistema ordena por `final_score` directo sin agrupación. En caso de empate exacto, desempata el número de reseñas (más reseñas = score más fiable estadísticamente).**

Los scores subjetivos (opiniones) tienen siempre menor peso que los objetivos (calidad académica, infraestructura).

---

### Score final

```
final_score = Σ (wᵢ · scoreᵢ)   donde Σwᵢ = 1
```

| Componente | Peso por defecto | Ajustable por usuario |
|---|---|---|
| `preference_match` — encaje personal | 35% | Sí (slider) |
| `distance` — proximidad | 25% | Sí (slider) |
| `affordability` — accesibilidad económica | 20% | Sí (slider) |
| `objective_quality` — calidad objetiva | 15% | Sí (slider) |
| `review` — valoración familias | 5% | Sí (slider) |

Los pesos se normalizan a suma = 1 antes del cálculo, por lo que el usuario puede introducir valores relativos libremente.

---

### Detalle de cada componente

#### 1. `preference_match` — Cosine similarity

Mide el ángulo entre el vector de preferencias del usuario y el vector de features del colegio.

```
preference_match = (u · s) / (‖u‖ · ‖s‖)  →  normalizado a [0, 1]
```

**Vector de dimensiones (10):**

| Dimensión | Descripción |
|---|---|
| `stem` | Tecnología, robótica, ciencias |
| `sports` | Programa deportivo |
| `arts` | Artes plásticas, música, teatro |
| `english` | Intensidad del inglés |
| `valencian` | Línea en valenciano |
| `bilingual` | Programa bilingüe (inglés/castellano) |
| `montessori` | Metodología Montessori |
| `traditional` | Metodología tradicional |
| `religion` | Carácter confesional |
| `inclusion` | Educación inclusiva / NEE |

Si el usuario no marca ninguna preferencia, el score es 0.5 (neutro). Los centros con características marcadas reciben puntuación positiva solo cuando el usuario también las valora.

---

#### 2. `distance_score` — Decaimiento logístico inverso

Función sigmoide inversa que penaliza la distancia de forma no lineal. La caída es suave al principio (distancias cortas) y se acelera al acercarse al radio máximo.

```python
score = 1 / (1 + exp(k · (d - d_mid)))
```

| Parámetro | Valor |
|---|---|
| `k` (pendiente) | 0.6 |
| `d_mid` | 40% del radio máximo |
| Score a 0 km | 1.0 |
| Score a `max_km` | 0.0 (exclusión) |

Los centros fuera del radio máximo quedan excluidos del ranking (score = 0, no se devuelven).

---

#### 3. `affordability_score` — Umbral del 15% del salario

Un centro es "cómodo económicamente" si su cuota mensual no supera el **15% del salario neto mensual**. Por encima del umbral, la penalización es lineal hasta llegar a 0.

```python
ratio = cuota_mensual / salario_neto
score = max(0, 1 - ratio / 0.15)
```

| Caso | Score |
|---|---|
| Centro público (cuota ~0€) | 1.0 |
| Cuota = 7.5% del salario | 0.5 |
| Cuota ≥ 15% del salario | 0.0 |

---

#### 4. `objective_quality_score` — Proxy de calidad objetiva

Compuesto de dos sub-scores, siempre calculados a partir de datos objetivos (nunca opiniones):

```
objective_quality = 0.6 · academic_score + 0.4 · infrastructure_score
```

**`academic_score`** — proxy con datos disponibles:

```python
academic = tipo_base + zona_bonus + ratio_bonus + bachillerato_bonus
```

| Factor | Contribución |
|---|---|
| Tipo base: público 0.60, concertado 0.70, privado 0.78 | Base |
| Índice de renta de la zona (proxy INE/GVA) | hasta +0.12 |
| Ratio alumnos/profesor (ideal 15:1, malo >28:1) | hasta +0.08 |
| Tiene Bachillerato (ciclo completo) | +0.04 |

**`infrastructure_score`** — valor por defecto según tipo (0.62 público / 0.72 concertado / 0.85 privado), actualizable con datos reales.

---

#### 5. `review_score` — Bayesian smoothing

Evita que un centro con 2 reseñas de 5★ supere a uno con 500 reseñas de 4.5★. Aplica suavizado bayesiano hacia la media global.

```
score_bayesiano = (n · r + C · m) / (n + C)
```

| Parámetro | Valor |
|---|---|
| `n` | Número de reseñas del centro |
| `r` | Rating medio del centro (0–5) |
| `C` | Constante de confianza = 10 |
| `m` | Media global de ratings = 3.8 |

El score se normaliza a [0, 1] dividiendo por 5.

---

### Regla de desempate

El ranking ordena directamente por `final_score` descendente, sin agrupación en cubos. En caso de empate exacto desempata el número de reseñas de Google:

```python
results.sort(key=lambda r: (-r.scores["final"], -r.google_review_count))
```

**Justificación:** el desempate por `google_review_count` es estadísticamente correcto porque un score calculado con más reseñas tiene menor varianza y es por tanto más fiable. El enfoque anterior agrupaba scores en cubos de 0.03 y desempataba por `objective_quality`, lo que introducía un sesgo implícito hacia la calidad académica independientemente de los pesos configurados por el usuario.

---

### Explicabilidad

Cada resultado incluye dos bloques de lenguaje natural: puntos positivos (`explanation`) y puntos a considerar (`weaknesses`). El bloque `weaknesses` solo incluye las dimensiones con score bajo y es vacío si el centro no tiene penalizaciones relevantes.

```json
{
  "final_score": 0.79,
  "scores": {
    "preference_match": 0.91,
    "distance": 0.87,
    "affordability": 0.55,
    "objective_quality": 0.74,
    "review": 0.72
  },
  "explanation": {
    "preference_match": "Muy alto encaje con tus preferencias educativas",
    "distance": "A 2.3 km (8 min en coche)",
    "cost": "Coste asumible (9.5% de tu salario)",
    "quality": "Buena calidad académica",
    "reviews": "Valoración positiva de las familias"
  },
  "weaknesses": {
    "reviews": "Sin valoraciones de Google — la puntuación es una estimación estadística, no refleja opiniones reales de familias"
  }
}
```

**Umbrales para incluir una entrada en `weaknesses`:**

| Componente | Umbral | Mensaje generado |
|---|---|---|
| `preference_match` | < 0.45 (con preferencias activas) | Pocas prioridades presentes en el centro |
| `distance` | < 0.45 | Distancia y tiempo estimado en coche |
| `affordability` | < 0.45 | % del salario que representa la cuota |
| `objective_quality` | < 0.62 | Nota proxy baja + aviso de limitación del dato |
| `review` (sin datos) | < 0.50 y < 5 reseñas | Aviso explícito de estimación estadística |
| `review` (con datos) | < 0.50 y ≥ 5 reseñas | Valoración baja en Google con N reseñas |

---

## Filtros de búsqueda disponibles

| Filtro | Tipo | Lógica |
|---|---|---|
| `school_types` | `["public","concertado","private"]` | OR — muestra centros de cualquiera de los tipos seleccionados |
| `school_levels` | `["infantil","primaria","secundaria","bachillerato","FP"]` | AND — muestra solo centros que impartan **todas** las etapas seleccionadas |
| `max_distance_km` | número | Hard filter — excluye centros fuera del radio |
| `preferences` | vector 10D [0,1] | Soft filter — influye en el score, no excluye |
| `weights` | objeto {user_fit, distance, cost, quality, reviews} | Ajusta la importancia de cada componente |

Sin selección en `school_types` o `school_levels` equivale a "todos".

---

## Notas de implementación

### Base de datos
- El modelo usa `School.code VARCHAR(50)` — los códigos OSM de relaciones llegan a 21 caracteres (`osm_relation_XXXXXXXXXXX`), por lo que `VARCHAR(20)` es insuficiente.
- La migración one-shot de SQLite a PostgreSQL está en `data/migrate_sqlite_to_pg.py`. Usa `TRUNCATE TABLE schools RESTART IDENTITY CASCADE` para garantizar idempotencia.

### Frontend responsive
- **Mobile** (`< lg`): layout de una columna con barra de tabs en el fondo (Filtros / Mapa / Resultados). Al pulsar "Buscar" se navega automáticamente al tab Mapa.
- **Desktop** (`lg:`): tres columnas fijas: FilterPanel (w-72) | Mapa (flex-1) | SchoolList (w-80).
- `SchoolDetail`: panel lateral en desktop, pantalla completa en mobile.
- Altura de viewport: `h-[100dvh]` para manejar correctamente el chrome del navegador en iOS.

### CSP (Content Security Policy)
Configurada en `next.config.js`. La directiva `connect-src` debe incluir `https://*.onrender.com` para permitir llamadas al backend en producción.

### Cold start en Render (plan gratuito)
El servicio duerme tras 15 min de inactividad. El frontend tiene `AbortSignal.timeout(60_000)` para tolerar el cold start (~30–60 s).

---

## Evolución prevista (roadmap)

### Datos
- [ ] Integración Google Places API para ratings reales
- [ ] Excel consulta lingüística GVA → `feature_valencian` fiable por centro
- [ ] Auxiliares de conversación CEICE (PDF) → `feature_english` fiable
- [ ] Índice de renta por zona desde microdatos INE
- [ ] Datos de resultados PAU/EvAU por centro (Ministerio de Educación)

### Modelo
- [ ] **Learning to Rank** (LambdaMART / XGBoost Ranker) entrenado con feedback implícito de clicks
- [ ] **Filtrado colaborativo**: "usuarios con perfil similar eligieron…"
- [ ] Aprendizaje del umbral de `affordability` por tramo salarial real

### Cobertura
- [ ] Extensión a toda España (cambio de bounding box en ETL)
