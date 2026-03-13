# eVaca Alerts App (Firebase + eToro)

Aplicación serverless para alertas de precio:
- Login/logout con Firebase Auth.
- CRUD de alertas en Firestore.
- Scheduler en Firebase Functions para evaluar precio contra eToro.
- Envío de email al cumplirse la condición (colección `mail`, compatible con Trigger Email).

## Estructura
- `functions/`: backend serverless (callable + scheduler).
- `web/`: frontend React.
- `firestore.rules`: reglas de seguridad.
- `firestore.indexes.json`: índices compuestos de Firestore.

## Firestore data model

### `alerts` collection

Campos principales:
- `userId` (string): dueño de la alerta.
- `instrumentId` (number): id interno del instrumento.
- `symbol` (string): ticker/símbolo visible.
- `displayName` (string): nombre amigable del activo.
- `condition` (`above` | `below`): regla de disparo.
- `targetPrice` (number): precio objetivo.
- `isActive` (boolean): habilitada o pausada.
- `intervalMinutes` (number): frecuencia de chequeo.
- `lastCheckedAt` (timestamp | null): último chequeo.
- `lastTriggeredAt` (timestamp | null): último disparo.
- `createdAt` (timestamp): creación.
- `updatedAt` (timestamp): última modificación.

### `notifications` collection

Campos principales:
- `userId` (string): usuario propietario.
- `alertId` (string): referencia lógica a la alerta origen.
- `instrumentId` (number), `symbol` (string), `displayName` (string)
- `condition` (`above` | `below`), `targetPrice` (number), `triggerPrice` (number)
- `status` (`pending` | `sent` | `failed`)
- `errorMessage` (string | null): error de delivery si aplica.
- `createdAt` (timestamp): fecha de creación del evento.

## Prerrequisitos
1. Proyecto Firebase creado.
2. Auth (Email/Password) habilitado.
3. Firestore habilitado.
4. Node.js 22.
5. Claves eToro (api key + user key).
6. Opcional: extensión `Trigger Email` de Firebase para procesar docs en `mail`.

## Setup
1. Configurar project id en `/.firebaserc`.
2. Instalar dependencias:

```bash
cd app
npm install
```

3. Definir secretos para Functions:

```bash
firebase functions:secrets:set ETORO_API_KEY
firebase functions:secrets:set ETORO_USER_KEY
```

4. Configurar frontend por entorno con variables (`Vite`):

```bash
cp web/.env.example web/.env
```

Completar **todas** las variables `VITE_FIREBASE_*` en cada entorno:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

Para `enforceAppCheck: true`, también configurá:

```bash
VITE_FIREBASE_APPCHECK_SITE_KEY=<recaptcha-v3-site-key>
```

Remote Config key for scoped verbose logging (default safe value: `false`):
- `logs_verbose_enabled`

### Entornos frontend
- Local: `web/.env` (no commitear secretos).
- Preview/CI: `web/.env.preview` con proyecto Firebase de staging y variables inyectadas en pipeline.
- Producción: `web/.env.production` con proyecto Firebase productivo y variables inyectadas en deploy.

La app falla al iniciar si falta cualquier variable requerida.

## Ejecutar local

```bash
cd app
npm run build
```

Para emuladores:

```bash
cd app/functions
npm run serve
```

Para frontend:

```bash
cd app/web
npm run dev
```

## Tests

```bash
cd app
npm run test
```

Dependency vulnerability gate (PR/merge CI):

```bash
cd app
npm run security:audit:ci
```

Monthly dependency report (scheduled workflow/manual run):

```bash
cd app
npm run security:audit:report
```

E2E (Playwright):

```bash
cd app
npm run web:test:e2e
```

## Deploy

```bash
cd app
firebase deploy --only functions,hosting,firestore:rules
```

## CI workflows

- Canonical workflow definitions live in `/.github/workflows`.
- Workflow files under `app/.github/workflows` are deprecated and should not be used.
- CI quality gates run as named steps: `security audit`, `functions lint`, `functions test coverage`, `functions rules tests`, `web accessibility tests`, `web tests`, and `build app`.

## Functions implementadas
- `searchEtoroInstruments`
- `getEtoroInstrumentRate`
- `marketDataSearchHttp` (HTTP GET wrapper for `/market-data/search`)
- `marketDataInstrumentRatesHttp` (HTTP GET wrapper for `/market-data/instruments/rates`)
- `listAlerts`
- `createAlert`
- `updateAlert`
- `deleteAlert`
- `checkAlerts` (schedule: cada 1 minuto)

## Notas técnicas
- Cada request a eToro genera `x-request-id` con UUID único.
- Claves eToro se leen desde Secret Manager.
- El frontend no llama eToro directamente; usa Functions.
- `checkAlerts` marca una alerta como `triggered` al primer match (one-shot). Si querés alertas repetibles, se cambia a `active` tras notificar.
- Colecciones operativas de alta rotación (`_rateLimits`, `schedulerLeases`) tienen limpieza programada y runbook en `docs/ttl-lifecycle-runbook.md`.

## Dependency patch protocol

- Severity SLA:
  - `critical`: patch or mitigate within 24 hours.
  - `high`: patch or mitigate within 72 hours.
  - `moderate`: patch in next monthly maintenance window.
  - `low`: backlog unless exploitability changes.
- Ownership:
  - `app/functions` vulnerabilities: backend owner/on-call.
  - `app/web` vulnerabilities: frontend owner/on-call.
  - shared/root dependencies: release owner for the current sprint.
- Emergency patch flow:
  1. Create hotfix branch with minimal dependency updates (`npm update`/pin exact safe version).
  2. Run `npm run security:audit:ci`, `npm run functions:test`, and `npm run test`.
  3. Deploy to preview first; verify auth, alert create/update, scheduler logs.
  4. Promote to production and monitor error budget/latency for 30 minutes.
- Rollback procedure:
  1. Revert dependency bump commit(s) or redeploy last known-good build artifact.
  2. Re-run smoke tests and confirm scheduler + callable endpoints recover.
  3. Open follow-up incident task with root cause and safer upgrade plan.
