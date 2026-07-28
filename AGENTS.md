# KCAI

KCAI is a full-stack staffing and operations application. It has a **React/Vite frontend** and an **Express/Mongoose backend**, with Redis/BullMQ available for background work.

## Stack
- **Root:** npm scripts orchestrate the backend and frontend concurrently.
- **`frontend/`:** React 19, Vite 7, React Router 7, TanStack Query, Zustand, Tailwind CSS 4, Radix UI, ESLint.
- **`backend/`:** Node.js ESM, Express 5, Mongoose, JWT, Joi, Axios, BullMQ/ioredis, Pino, PDFKit.
- **External integration:** ShiftCare API (credentials are configured through backend environment variables or session login).

## Commands
Run from the repository root unless a command names a subdirectory:

```bash
npm run dev                    # Start backend + frontend together
npm run backend                # Start backend in watch mode
npm run frontend               # Start Vite frontend
npm run test:tmp-fixtures      # Validate temporary fixture handling

npm run dev --prefix backend   # Backend watch mode
npm test --prefix backend      # Backend Node test runner
npm run seed:user --prefix backend
npm run seed:award-rates --prefix backend
npm run seed:melbourne-holidays --prefix backend

npm run verify --prefix frontend  # ESLint App.jsx + production build
npm run lint --prefix frontend
npm run build --prefix frontend
```

## Layout
- `backend/server.js` — Express entry point.
- `backend/config/` — runtime configuration.
- `backend/middlewares/` — authentication and request middleware.
- `backend/modules/` — feature routes, controllers, and services.
- `backend/seeds/` — data seeds and migrations.
- `backend/scripts/` — maintenance/documentation scripts.
- `frontend/src/api/` — API clients and TanStack Query hooks.
- `frontend/src/components/` — reusable React components.
- `frontend/src/pages/` — route-level screens.
- `frontend/src/store/` — Zustand state.
- `frontend/src/ui/` — UI primitives.
- `frontend/src/utils/` — shared utilities.

## Environment and security
- Backend credentials and secrets belong only in `backend/.env`; do not commit them or expose them to the frontend.
- Expected ShiftCare settings include `SHIFTCARE_API_URL`, `SHIFTCARE_API_KEY`, `SHIFTCARE_API_SECRET`, `PORT`, `NODE_ENV`, and `SESSION_SECRET`.
- The backend proxies ShiftCare requests to keep credentials server-side and handles session-based credential overrides.
- Use `backend/docker-compose.example.yml` only as a deployment/reference template; never place production secrets in it.

## Engineering rules
- Keep API/business logic in backend modules; keep UI state and presentation in the frontend.
- Preserve the backend's ESM module format.
- Prefer existing TanStack Query and Zustand patterns over new ad-hoc client state mechanisms.
- Run the narrowest relevant verification before finishing: backend tests for backend changes; frontend lint/build for frontend changes.
- Do not introduce write operations against ShiftCare unless the task explicitly requires it; the original dashboard API was read-only.
- Check existing feature conventions before adding routes, schemas, migrations, or UI primitives.

## Agent notes
- The root `dev` script runs both apps via `concurrently`; avoid starting duplicate backend/frontend processes on the same ports.
- Frontend defaults to Vite's development port; backend configuration controls its own port.
- Redis is a runtime dependency when a feature uses BullMQ/ioredis; do not assume every local development task requires it.
- For broad changes spanning both apps, validate backend and frontend separately before reporting completion.
