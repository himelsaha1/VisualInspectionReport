# Maximo Visual Intelligence — Inspections UI

A standalone React + Carbon Design System web application for the IBM Maximo inspections workflow, powered by Maximo Visual Intelligence (MVI).

## Setup

```bash
npm install
npm run dev
```

Visit `http://localhost:5173` to view the app.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in values as needed:

| Variable | Description | Default |
|---|---|---|
| `VITE_MVI_BASE_URL` | Base URL of your MVI instance | *(stub used when empty)* |
| `VITE_MAXIMO_BASE_URL` | Base URL of your Maximo/MAS instance | *(stub used when empty)* |
| `VITE_MOCK_WO_FAIL_RATE` | Probability (0–1) that mock WO creation fails | `0` |
| `VITE_CONFIDENCE_THRESHOLD` | Min confidence % before a warning is shown | `50` |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | TypeScript compile + production bundle |
| `npm run lint` | ESLint check |
| `npm run preview` | Preview the production build locally |

## Folder Structure

```
src/
  components/       # Shared Carbon wrapper / small reusable components
  constants/        # Route names, status enums, confidence thresholds
  features/
    inspection-list/  # Inspection list screen
    capture/          # Start inspection + capture/upload screen
    results/          # MVI analysis + results screen
    work-order/       # Work order creation screen
    history/          # Inspection history screen
    dashboard/        # Reporting dashboard screen
  hooks/            # Custom React hooks
  mock-data/        # JSON fixtures used by service stubs
  services/         # API layer (MVI, Maximo, inspection CRUD)
  types/            # Shared TypeScript interfaces
```

## MVI Integration

When a real MVI instance is available, replace the stub in [`src/services/mvi.service.ts`](src/services/mvi.service.ts):

```
POST {VITE_MVI_BASE_URL}/api/v1/deployment/{deploymentId}/infer
```

Docs: https://www.ibm.com/docs/en/masv-and-l/maximo-vi/cd?topic=overview-rest-apis

## Maximo Integration

When a real Maximo instance is available, replace stubs in [`src/services/maximo.service.ts`](src/services/maximo.service.ts):

- Assets: `GET {VITE_MAXIMO_BASE_URL}/maximo/oslc/os/mxasset`
- Work Orders: `POST {VITE_MAXIMO_BASE_URL}/maximo/oslc/os/mxwo`

## MAS Embedding

The app is structured for future embedding in Maximo Application Suite (MAS). To embed:
1. Set `base` in `vite.config.ts` to the MAS sub-path
2. Wire `src/services/auth.service.ts` to MAS IAM token exchange
3. Deploy the built `dist/` folder as a static MAS UI extension
