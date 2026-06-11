# TripPlan

Planificador de viajes colaborativo con IA. Un grupo de viajeros crea un viaje, cada uno registra su perfil (intereses, dieta, presupuesto, vuelo de llegada), y un agente LLM propone la ruta optima y genera el itinerario dia a dia.

## Arquitectura

Ver [`docs/architecture.md`](docs/architecture.md) para el diagrama completo y las decisiones de stack.

**Stack:** Next.js 14 · TypeScript · Oracle Autonomous DB 26ai · OCI Generative AI (Cohere Command R+) · NextAuth.js v5 · Tailwind CSS

**Integraciones externas:**

| Servicio | Uso |
|---|---|
| OCI Generative AI — Cohere Command R+ | Agente planificador (chat multi-turno) + generacion de itinerario dia a dia |
| Oracle Autonomous Database 26ai | Persistencia de viajes, perfiles, itinerarios y mensajes del agente |
| AirLabs API | Autocompletar datos de vuelo a partir del codigo IATA |
| Wikipedia REST API | Preview de ciudades: descripcion e imagenes de lugares de interes |

---

## Requisitos previos

- Node.js 18 o superior
- Cuenta en Oracle Cloud con acceso a Generative AI y Autonomous Database
- API key de AirLabs (tier gratuito disponible en airlabs.co)
- Wallet de conexion Oracle (archivo `.zip` con los certificados TLS)

---

## Setup local

### 1. Clonar el repositorio

```bash
git clone <repo-url>
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

Crea el archivo `.env.local` en la raiz del proyecto:

```env
# Oracle Autonomous Database
ORACLE_USER=admin
ORACLE_PASSWORD="tu_password"
ORACLE_CONNECT_STRING=(description=(retry_count=20)(retry_delay=3)(address=(protocol=tcps)(port=1522)(host=adb.<region>.oraclecloud.com))(connect_data=(service_name=<service_name>_tp.adb.oraclecloud.com))(security=(ssl_server_dn_match=yes)))
ORACLE_WALLET_DIR=/ruta/absoluta/al/proyecto/wallet/extracted
ORACLE_WALLET_PASSWORD="tu_wallet_password"

# OCI Generative AI
OCI_USER_OCID=ocid1.user.oc1..xxxxx
OCI_FINGERPRINT=xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx
OCI_TENANCY_OCID=ocid1.tenancy.oc1..xxxxx
OCI_REGION=us-chicago-1
# Contenido del key.pem en base64: cat oci-keys/key.pem | base64 -w 0
OCI_PRIVATE_KEY_B64=

# NextAuth
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=genera_con_openssl_rand_base64_32
AUTH_SECRET=mismo_valor_que_NEXTAUTH_SECRET

# AirLabs
AIRLABS_API_KEY=tu_api_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=TripPlan
PORT=3001
```

Alternativa para la clave privada: coloca el archivo `key.pem` directamente en `oci-keys/key.pem` sin necesidad de codificarlo en base64.

### 4. Inicializar la base de datos

```bash
node scripts/init-db.js
```

Crea todas las tablas necesarias en Oracle DB.

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
│   │   ├── auth/          # NextAuth handlers
│   │   ├── cities/        # Wikipedia preview
│   │   ├── flights/       # AirLabs lookup
│   │   └── trips/         # CRUD + agente planificador + generacion SSE
│   ├── auth/              # Paginas de login y registro
│   └── trips/             # Dashboard, wizard nuevo viaje, itinerario
├── components/
│   ├── trips/             # TripDashboard, TravelerProfileForm, AlbumTab
│   ├── itinerary/         # DayItinerary, ItineraryItem
│   └── ui/                # NavLink, UserMenu
└── lib/
    ├── oci-ai.ts          # Logica LLM: agente planificador y generacion de dias
    └── repositories/      # Acceso a Oracle DB
```

---

## Flujo principal de uso

1. **Registro / Login** — crea cuenta con email y contrasena
2. **Nuevo viaje** — define titulo, destino, fechas; ingresa el codigo de vuelo para autocompletar datos; completa el perfil personal con intereses, ritmo de viaje y presupuesto
3. **Comparte el viaje** — invita a otros viajeros con link; cada uno registra su propio perfil
4. **Agente planificador** — chat con IA que hace hasta 2 preguntas y propone una ruta de ciudades con dias asignados; el usuario puede ajustar la propuesta manualmente antes de aprobar
5. **Generacion en streaming** — el itinerario se genera dia a dia con SSE, visible en tiempo real mientras se construye
6. **Vista de itinerario** — actividades, comidas y transporte por dia; permite pedir alternativas a cualquier actividad con IA
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

En produccion `ORACLE_WALLET_DIR` debe apuntar a un directorio accesible. Se recomienda usar `OCI_PRIVATE_KEY_B64` para la clave privada en lugar de depender de un archivo en disco.

---

## Evaluacion del LLM

Ver [`docs/llm-eval.md`](docs/llm-eval.md) para el golden set de 8 casos de prueba del agente planificador y la generacion de itinerarios, con asserts, resultados observados y estrategias de mitigacion.
