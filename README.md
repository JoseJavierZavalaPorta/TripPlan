# TripPlan

Planificador de viajes colaborativo con IA. Un grupo de viajeros crea un viaje, cada uno registra su perfil (intereses, dieta, presupuesto, vuelo de llegada), y un agente LLM propone la ruta optima y genera el itinerario dia a dia en tiempo real.

**Stack:** Next.js 14 · TypeScript · Oracle Autonomous DB 26ai · OCI Generative AI (Cohere Command R+) · NextAuth.js v5 · Tailwind CSS · Railway

---

## Integraciones externas

### 1. OCI Generative AI — Cohere Command R+

| | |
|---|---|
| **Tipo** | LLM via REST (firmado RSA-SHA256) |
| **Modelo** | `amaaaaaask7dceyapnibwg42qjhwaxrlqfpreueirtwghiwvv2whsnwmnlva` |
| **Autenticacion** | OCI Signature v1 — clave privada RSA + fingerprint |
| **Archivo** | `src/lib/oci-ai.ts` |

Usos dentro de la app:

- **Agente planificador** (`runPlanningAgent`): chat multi-turno que hace hasta 2 preguntas al grupo y propone una ruta de ciudades con dias asignados. Devuelve JSON estructurado `{type, proposal, question}`.
- **Generacion de itinerario** (`generateItinerary`): recibe ciudad, dia, perfil del grupo y lista de lugares ya visitados; genera entre 6-10 actividades del dia en JSON. Se ejecuta en streaming SSE, un dia a la vez.
- **Alternativas de actividad** (`suggestItemAlternative`): reemplaza una actividad especifica por una alternativa diferente sin repetir lugares ya usados.

La firma HTTP es manual (no hay SDK oficial de OCI para Node.js). Se implementa en `src/lib/oci-ai.ts` usando `node:crypto` con el algoritmo `RSA-SHA256`.

---

### 2. Oracle Autonomous Database 26ai

| | |
|---|---|
| **Tipo** | Base de datos relacional Oracle (OLTP) |
| **Conexion** | TLS con wallet de certificados (.p12 / .sso) |
| **Driver** | `oracledb` (cliente nativo Node.js, modo Thick) |
| **Archivo** | `src/lib/db.ts`, `src/lib/repositories/` |

Tablas principales:

| Tabla | Descripcion |
|---|---|
| `USERS` | Cuentas de usuario con password hasheado (bcrypt) |
| `TRIPS` | Viajes con titulo, destino, fechas y estado de vuelo |
| `TRIP_PARTICIPANTS` | Relacion muchos-a-muchos usuarios ↔ viajes |
| `TRAVELER_PROFILES` | Perfil personal por viajero: dieta, ritmo, intereses, presupuesto, fechas de llegada/salida |
| `PLANNING_MESSAGES` | Historial de conversacion con el agente planificador |
| `ITINERARY_DAYS` | Dias del itinerario con ciudad asignada |
| `ITINERARY_ITEMS` | Actividades, comidas y transportes dentro de cada dia |
| `TRIP_MEDIA` | Fotos subidas por los participantes, organizadas por dia |

---

### 3. AirLabs API

| | |
|---|---|
| **Tipo** | REST API de datos de vuelos en tiempo real |
| **Autenticacion** | API key en query param (`api_key`) |
| **Endpoint propio** | `GET /api/flights/lookup?code=IB0124` |
| **Archivo** | `src/app/api/flights/lookup/route.ts` |

La app recibe un codigo IATA de vuelo (ej: `LA2031`) y consulta AirLabs para autocompletar:
- Nombre de la aerolinea
- Ciudad y aeropuerto de origen y destino
- Hora de salida y llegada
- Si el vuelo llega al dia siguiente (`+1 dia`)

Estos datos se usan para pre-rellenar el perfil viajero (fecha/hora de llegada al destino) sin que el usuario tenga que ingresarlos manualmente.

Normalizacion aplicada: AirLabs requiere codigo sin ceros iniciales (`IB124`), pero los usuarios suelen escribir `IB0124`. El endpoint normaliza automaticamente antes de consultar.

---

### 4. Wikipedia REST API

| | |
|---|---|
| **Tipo** | REST API publica — sin autenticacion ni API key |
| **Endpoint propio** | `GET /api/cities/preview?city=Paris` |
| **Archivo** | `src/app/api/cities/preview/route.ts` |

Cuando el agente propone una ciudad, la interfaz muestra una tarjeta con:
- Extracto de descripcion de la ciudad (primer parrafo de Wikipedia)
- Imagen representativa del lugar

Se usa el endpoint `https://en.wikipedia.org/api/rest_v1/page/summary/{ciudad}` combinado con `https://en.wikipedia.org/w/api.php` para obtener imagenes de landmarks. Se filtran resultados de personas, aeropuertos y articulos de desambiguacion con heuristicas por palabras clave.

---

### 5. Deep links de transporte

| | |
|---|---|
| **Tipo** | Links directos a servicios externos (sin API) |
| **Archivo** | `src/app/trips/[id]/itinerary/plan/PlanningAgent.tsx` |

Entre cada par de ciudades del itinerario se muestran botones de acceso directo para que el usuario compare y reserve transporte:

| Servicio | URL generada |
|---|---|
| Rome2rio | `rome2rio.com/s/{origen}/{destino}` |
| Google Flights | `google.com/travel/flights?q=flights+from+{origen}+to+{destino}` |
| Google Maps | `google.com/maps/dir/{origen}/{destino}` |
| Trainline | `thetrainline.com/train-times/{origen}-to-{destino}` |

No requieren API key. Los precios son siempre en tiempo real desde cada plataforma.

---

## Arquitectura

Ver [`docs/architecture.md`](docs/architecture.md) para el diagrama completo (Mermaid flowchart + sequence diagram) y las decisiones de stack con trade-offs.

---

## Requisitos previos

- Node.js 18 o superior
- Cuenta en Oracle Cloud con acceso a Generative AI y Autonomous Database
- API key de AirLabs (tier gratuito disponible en airlabs.co)
- Wallet de conexion Oracle (archivo `.zip` con los certificados TLS)

---

## Setup local

### 1. Clonar e instalar

```bash
git clone https://github.com/JoseJavierZavalaPorta/TripPlan.git
cd TripPlan
npm install
```

### 2. Extraer el wallet Oracle

Descarga el wallet desde Oracle Cloud Console → Autonomous Database → DB Connection → Download wallet.

```bash
mkdir -p wallet/extracted
unzip wallet/wallet.zip -d wallet/extracted
```

### 3. Variables de entorno

Copia `.env.local.example` a `.env.local` y completa los valores:

```bash
cp .env.local.example .env.local
```

### 4. Inicializar la base de datos

```bash
node scripts/init-db.js
```

### 5. Ejecutar en desarrollo

```bash
npm run dev
```

La app queda disponible en http://localhost:3001.

---

## Estructura del proyecto

```
src/
├── app/
│   ├── api/
│   │   ├── auth/                  # NextAuth handlers
│   │   ├── cities/preview/        # Wikipedia REST API
│   │   ├── flights/lookup/        # AirLabs API
│   │   └── trips/
│   │       ├── route.ts           # CRUD viajes
│   │       └── [id]/
│   │           ├── route.ts       # GET/PATCH viaje
│   │           ├── profile/       # Perfil viajero
│   │           ├── itinerary/
│   │           │   ├── agent/     # Agente planificador (OCI LLM)
│   │           │   └── generate/  # Generacion SSE (OCI LLM)
│   │           └── media/         # Subida de fotos
│   ├── auth/                      # Paginas de login y registro
│   └── trips/                     # Dashboard, wizard nuevo viaje, itinerario
├── components/
│   ├── trips/                     # TripDashboard, TravelerProfileForm, AlbumTab
│   └── ui/                        # NavLink, UserMenu
└── lib/
    ├── oci-ai.ts                  # OCI Generative AI: agente + generacion + alternativas
    └── repositories/              # Acceso a Oracle DB
```

---

## Flujo principal de uso

1. **Registro / Login** — crea cuenta con email y contrasena
2. **Nuevo viaje** — define titulo, destino, fechas; ingresa el codigo de vuelo para autocompletar datos con AirLabs; completa el perfil personal
3. **Comparte el viaje** — invita a otros viajeros con link; cada uno registra su propio perfil
4. **Agente planificador** — chat con OCI LLM que hace hasta 2 preguntas y propone una ruta de ciudades con dias asignados; el usuario puede ajustar la propuesta manualmente antes de aprobar
5. **Generacion en streaming** — el itinerario se genera dia a dia con SSE, visible en tiempo real mientras se construye (OCI LLM)
6. **Vista de itinerario** — actividades, comidas y transporte por dia; links directos a Rome2rio / Google Flights para reservar traslados; pedir alternativas a cualquier actividad con IA
7. **Album** — los participantes suben fotos del viaje organizadas por dia

---

## Deploy en Railway

El proyecto incluye `railway.json` con la configuracion base.

Variables adicionales para produccion:

```env
NEXTAUTH_URL=https://tu-dominio.railway.app
NEXT_PUBLIC_APP_URL=https://tu-dominio.railway.app
NODE_ENV=production
```

En produccion se recomienda usar `OCI_PRIVATE_KEY_B64` (clave en base64) y `ORACLE_WALLET_BASE64` (wallet en base64) en lugar de rutas a archivos en disco.

---

## Evaluacion del LLM

Ver [`docs/llm-eval.md`](docs/llm-eval.md) para el golden set de 8 casos de prueba del agente planificador y la generacion de itinerarios, con asserts, resultados observados y estrategias de mitigacion.
