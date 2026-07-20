# Maximo Visual Intelligence — Inspections Tab Revamp Plan

## Overview

Build a standalone React + Carbon Design System web application that revamps the IBM Maximo inspections workflow end-to-end using Maximo Visual Intelligence (MVI). The app is self-contained (no Maximo runtime dependency) but is architected for future embeddability inside Maximo Application Suite (MAS) — Carbon theming, a clean `src/services/` API boundary, and MAS-compatible auth hooks are built in from the start.

**Scope of this build:**
- Field photo capture / upload → MVI AI inference (via mock stub) → results review with annotated image → work order creation (via mock Maximo API stub) → inspection history + rich Carbon Charts reporting dashboard
- All MVI and Maximo API calls go through a typed service layer with clearly marked `// TODO: replace with real endpoint` integration points
- No real MVI instance or Maximo backend is required to run or demo

**Non-goals:**
- Real MVI or Maximo API wiring (stub only)
- User auth / login screen (deferred; MAS SSO hook is left as a stub)
- Mobile-native packaging (responsive web only)

---

## Sub-tasks

---

### Sub-task 1 — Project Scaffold

**Status:** `[ ] pending`

**Intent**
Bootstrap the application with the correct toolchain and folder structure so every subsequent sub-task builds on a consistent, linted, and themed foundation.

**Expected Outcomes**
- `package.json` present with all core dependencies installed
- Vite dev server starts with a Carbon-themed app shell placeholder
- ESLint + Prettier configured and passing
- Folder structure matches the planned feature layout
- Carbon Design System g100 (dark) and white (light) themes wired via `@carbon/react`

**Todo List**
1. `npm create vite@latest . -- --template react-ts` to initialise a TypeScript React project in the repo root
2. Install dependencies: `@carbon/react`, `@carbon/charts-react`, `react-router-dom`, `d3`
3. Install dev dependencies: `eslint`, `prettier`, `@typescript-eslint/eslint-plugin`, `vite-plugin-svgr`
4. Create the top-level folder structure:
   ```
   src/
     components/      # shared Carbon wrappers / small reusable components
     features/        # one folder per screen (inspection-list, capture, results, work-order, history, dashboard)
     services/        # API stubs (mvi.service.ts, maximo.service.ts, inspection.service.ts)
     hooks/           # custom React hooks
     types/           # shared TypeScript interfaces
     constants/       # app-wide constants (routes, status enums, confidence thresholds)
     mock-data/       # JSON fixtures used by service stubs
   ```
5. Set up `src/main.tsx` with Carbon `Theme` provider (default white, togglable)
6. Add `.env.example` with `VITE_MVI_BASE_URL` and `VITE_MAXIMO_BASE_URL` placeholder vars
7. Configure `vite.config.ts` with path aliases (`@/` → `src/`)
8. Verify `npm run dev`, `npm run lint`, and `npm run build` all pass

**Relevant Context**
- Carbon React: `@carbon/react` v1.x (includes all components and tokens)
- Carbon Charts React: `@carbon/charts-react` v1.x (wraps D3-based chart library)
- All subsequent sub-tasks rely on the folder structure established here

---

### Sub-task 2 — Mock API Service Layer

**Status:** `[x] done`

**Intent**
Create a typed, stub-only service layer that mirrors the shape of the real MVI and Maximo REST APIs. Every screen imports from services — never calls `fetch` directly — so swapping stubs for real endpoints requires changes in one place only.

**Expected Outcomes**
- `src/services/mvi.service.ts` — exports `analyzeImage(file: File): Promise<MviInferenceResult>`
- `src/services/maximo.service.ts` — exports `createWorkOrder(payload: WorkOrderPayload): Promise<WorkOrderResult>` and `getAssets(): Promise<Asset[]>`
- `src/services/inspection.service.ts` — exports `getInspections()`, `getInspection(id)`, `createInspection()`, `updateInspection()`
- `src/mock-data/` contains realistic JSON fixtures (assets, inspection records, MVI inference results with bounding boxes)
- All service functions include a `// TODO: replace stub with real API call` comment block with the expected real endpoint URL pattern
- TypeScript interfaces in `src/types/` cover all domain models

**Todo List**
1. Define TypeScript interfaces in `src/types/`:
   - `Inspection`, `InspectionStatus` enum, `Asset`, `InspectionType`
   - `MviInferenceResult` (with `detections: Detection[]`, each with `label`, `confidence`, `bbox: [x,y,w,h]`)
   - `WorkOrderPayload`, `WorkOrderResult`
2. Create `src/mock-data/assets.json` — 10 sample assets (pumps, pipes, tanks)
3. Create `src/mock-data/inspections.json` — 15 sample inspection records in various statuses
4. Create `src/mock-data/mvi-inference.json` — 3 sample MVI results with bounding boxes and confidence scores
5. Implement `mvi.service.ts` — simulate 1.5s network delay, return random mock inference fixture
6. Implement `maximo.service.ts` — `createWorkOrder` returns success/failure based on a `VITE_MOCK_WO_FAIL_RATE` env var (default 0); `getAssets` returns mock assets
7. Implement `inspection.service.ts` — CRUD backed by `localStorage` so state persists across page reloads in demo mode
8. Export a `mockDelay(ms)` utility from `src/services/utils.ts` used by all stubs

**Relevant Context**
- MVI REST API shape reference: https://www.ibm.com/docs/en/masv-and-l/maximo-vi/cd?topic=overview-rest-apis
- Bounding box format follows MVI 8.6+ convention: `[xmin, ymin, width, height]` normalised 0–1
- `localStorage`-backed inspection CRUD enables a self-contained demo without a backend

---

### Sub-task 3 — Inspection List Screen

**Status:** `[-] in progress`

**Intent**
Give users a central view of all inspections — a Carbon `DataTable` with filters and a clear entry point to start new inspections.

**Expected Outcomes**
- Route `/inspections` renders the Inspection List screen
- `DataTable` shows columns: Asset Name, Asset ID, Inspection Type, Status (with `Tag`), Date, Actions
- `TableToolbar` has search, status filter `Dropdown`, and "Start inspection" `Button`
- Clicking a row or "View" action navigates to the Results screen for that inspection
- Clicking "Start inspection" navigates to the Capture/Upload screen
- Empty state shown with `Tile` + illustration when no inspections exist

**Todo List**
1. Create `src/features/inspection-list/InspectionListPage.tsx`
2. Use `inspection.service.ts` → `getInspections()` via a `useInspections` hook (`src/hooks/useInspections.ts`)
3. Implement `DataTable` with toolbar search and status `Dropdown` filter (filters applied client-side)
4. Map `InspectionStatus` enum values to Carbon `Tag` types (e.g. `pending` → grey, `in-progress` → blue, `complete` → green, `failed` → red)
5. Add "Start inspection" `Button` (kind="primary") in toolbar — routes to `/inspections/new`
6. Wire row-level "View results" action to `/inspections/:id/results`
7. Add an empty state `Tile` with a descriptive message when the inspection list is empty
8. Register route `/inspections` in `src/App.tsx`

**Relevant Context**
- Carbon `DataTable`, `TableToolbar`, `Tag`, `Button`, `Tile` from `@carbon/react`
- `useInspections` hook wraps `inspection.service.getInspections()` with loading/error state

---

### Sub-task 4 — Start Inspection + Capture / Upload Screen

**Status:** `[ ] pending`

**Intent**
Allow a technician to select an asset, choose an inspection type, and provide one or more images (camera capture on mobile, file upload on desktop) before triggering MVI analysis.

**Expected Outcomes**
- Route `/inspections/new` renders the Start Inspection screen
- Asset selector (`ComboBox`) populated from `maximo.service.getAssets()`
- Inspection type `Select` (Visual, Thermal, Structural)
- `FileUploader` (drag-and-drop) accepting JPG/PNG, max 10 MB, up to 5 images
- Image preview grid showing uploaded thumbnails with a remove button per image
- "Analyse" `Button` (disabled until ≥ 1 image and asset are selected) triggers navigation to the Analysis/Results screen
- Basic `Form` validation with inline Carbon `InlineNotification` error messages

**Todo List**
1. Create `src/features/capture/CaptureUploadPage.tsx`
2. Wire `ComboBox` to `maximo.service.getAssets()` with loading skeleton
3. Build inspection type `Select` from `InspectionType` constants
4. Implement `FileUploader` with file type and size validation; store files in local component state
5. Build thumbnail preview grid using Carbon `Tile` with a close `Button` overlay per image
6. Add `Form` validation: asset required, at least 1 image required
7. On "Analyse" click: call `inspection.service.createInspection()` to create a pending record, then navigate to `/inspections/:id/analysis`
8. Register route `/inspections/new` in `src/App.tsx`

**Relevant Context**
- Carbon `ComboBox`, `Select`, `FileUploader`, `Button`, `Form`, `InlineNotification`, `Tile` from `@carbon/react`
- Images are held in component state (not uploaded to a server) until the analysis step

---

### Sub-task 5 — MVI Analysis + Results Screen

**Status:** `[ ] pending`

**Intent**
Show the AI analysis lifecycle (loading state → annotated image with bounding boxes → defect list with confidence scores) and allow the user to decide to approve findings or re-capture.

**Expected Outcomes**
- Route `/inspections/:id/analysis` triggers `mvi.service.analyzeImage()` on mount
- During analysis: full-screen `Loading` spinner with status text ("Sending image to MVI…", "Analysing…")
- After analysis: annotated image with coloured bounding boxes drawn via `<canvas>` overlay
- Defects panel: `DataTable` or structured list showing label, confidence % (`ProgressBar`), severity (`Tag`)
- "Approve and create work order" `Button` (primary) + "Re-capture" `Button` (secondary)
- Confidence score below a configurable threshold (default 50%) flagged with a warning `InlineNotification`

**Todo List**
1. Create `src/features/results/AnalysisResultsPage.tsx`
2. On mount, call `mvi.service.analyzeImage()` with the image(s) from the inspection record; show `Loading` skeleton during the stub delay
3. Build `BoundingBoxCanvas` component (`src/components/BoundingBoxCanvas.tsx`) — renders `<img>` + `<canvas>` overlay, draws coloured rectangles and labels for each detection
4. Build `DefectList` component — shows each detection as a row with label, `ProgressBar` for confidence, `Tag` for severity (high/medium/low derived from confidence)
5. Show `InlineNotification` (kind="warning") when any detection confidence < threshold constant
6. Wire "Approve and create work order" to navigate to `/inspections/:id/work-order`
7. Wire "Re-capture" to navigate back to `/inspections/new` with the asset pre-populated
8. Update inspection record status to `complete` or `failed` via `inspection.service.updateInspection()`
9. Register route `/inspections/:id/analysis` in `src/App.tsx`

**Relevant Context**
- `BoundingBoxCanvas` uses the HTML5 Canvas API — no external charting library needed
- Confidence threshold constant lives in `src/constants/inspection.constants.ts`
- MVI bounding box format: normalised `[xmin, ymin, width, height]` must be scaled to image pixel dimensions

---

### Sub-task 6 — Work Order Creation Screen

**Status:** `[ ] pending`

**Intent**
Pre-fill a Maximo-style work order form from the MVI results and submit it to the mock Maximo API, completing the end-to-end demoable flow.

**Expected Outcomes**
- Route `/inspections/:id/work-order` renders a pre-filled WO form
- Fields auto-populated from MVI results: Description (top defect label), Priority (from severity), Asset ID, Location, Reported By
- All fields are editable before submission
- Submit calls `maximo.service.createWorkOrder()` — success shows a `ToastNotification` with the WO number; failure shows an error `InlineNotification`
- "Cancel" returns to the Results screen without creating a WO

**Todo List**
1. Create `src/features/work-order/WorkOrderPage.tsx`
2. Pull inspection + MVI results from `inspection.service.getInspection(id)` to pre-fill the form
3. Build the form with Carbon `TextInput`, `Select` (priority), `TextArea` (description), `DatePicker` (due date)
4. Add form validation (description and asset required)
5. Wire Submit to `maximo.service.createWorkOrder()` with a loading `InlineLoading` spinner on the button
6. On success: show `ToastNotification` with WO number, update inspection record with `workOrderId`, redirect to `/inspections` after 3 s
7. On failure: show `InlineNotification` (kind="error") — allow retry
8. Register route `/inspections/:id/work-order` in `src/App.tsx`

**Relevant Context**
- `VITE_MOCK_WO_FAIL_RATE` env var controls stub failure rate for demo/testing purposes
- Carbon `TextInput`, `TextArea`, `Select`, `DatePicker`, `Button`, `InlineLoading`, `ToastNotification`, `InlineNotification`

---

### Sub-task 7 — Inspection History + Reporting Dashboard

**Status:** `[ ] pending`

**Intent**
Provide rich historical visibility: a filterable inspection history table and an aggregated Carbon Charts dashboard with KPI tiles and trend charts.

**Expected Outcomes**
- Route `/history` renders a full inspection history `DataTable` with date-range `DatePicker` filter and asset-type `Dropdown` filter
- Route `/dashboard` renders:
  - 4 KPI `Tile` cards: Total Inspections, Pass Rate (%), Avg Confidence Score, Work Orders Created
  - Line chart: defect count over time (grouped by week)
  - Grouped bar chart: defect types by asset category
  - All charts respect the selected date range and asset type filters
- Filters are shared state via React Context or URL query params
- Charts use mock data from `src/mock-data/` with enough volume (50+ records) to show meaningful trends

**Todo List**
1. Expand `src/mock-data/inspections.json` to 50+ records spanning 6 months for realistic trend data
2. Create `src/features/history/HistoryPage.tsx` — full DataTable with date-range and asset-type filters
3. Create `src/features/dashboard/DashboardPage.tsx`
4. Build `KpiTile` component (`src/components/KpiTile.tsx`) — wraps Carbon `Tile` with a stat number, label, and trend delta
5. Implement the defect-count-over-time line chart using `@carbon/charts-react` `LineChart`
6. Implement the defect-types-by-asset-category grouped bar chart using `@carbon/charts-react` `GroupedBarChart`
7. Wire filter controls (date range, asset type) to update chart data via a `useDashboardData` hook
8. Register routes `/history` and `/dashboard` in `src/App.tsx`

**Relevant Context**
- `@carbon/charts-react` requires `@carbon/charts` peer dep and its own CSS import
- Date range filtering is applied in the `useDashboardData` hook against the mock data array
- KPI delta (e.g. "↑ 12% vs last period") is computed in the hook from two date windows

---

### Sub-task 8 — App Shell, Navigation, and MAS Embedding Hooks

**Status:** `[ ] pending`

**Intent**
Tie all screens together with a Carbon `Shell`-compliant layout (header + side nav), wire all routes, and add the thin embedding hooks needed for future MAS integration.

**Expected Outcomes**
- `Carbon` `Header` with IBM logo, app name "Maximo Inspections", and a theme toggle (`Toggle`)
- `SideNav` with links: Inspections, History, Dashboard — active state tracking
- Breadcrumb `Breadcrumb` component shown on all inner screens
- Responsive layout: `SideNav` collapses to hamburger on small viewports
- `src/services/auth.service.ts` stub with `getCurrentUser(): Promise<User>` and a `// TODO: wire to MAS IAM` comment
- `index.html` `<base>` tag and `vite.config.ts` `base` option documented for MAS iframe embed
- `README.md` updated with setup instructions, env var table, and architecture overview

**Todo List**
1. Create `src/components/AppShell.tsx` — wraps `Header`, `SideNav`, and a `<main>` content area
2. Implement `Header` with IBM logo SVG, app title, and a `Toggle` for light/dark Carbon theme (persisted to `localStorage`)
3. Implement `SideNav` with nav items mapped to route constants; highlight active route using `useLocation`
4. Add `Breadcrumb` component that derives breadcrumb items from the current route path
5. Create `src/services/auth.service.ts` stub returning a hardcoded user; mark with MAS IAM integration TODO
6. Wrap all routes in `AppShell` inside `src/App.tsx` via React Router's `<Outlet>` pattern
7. Add `<meta name="viewport">` and responsive CSS grid for the shell layout
8. Update `README.md`: project description, `npm install` / `npm run dev` setup, env var table, folder map, MVI and Maximo integration guide

**Relevant Context**
- Carbon `Header`, `HeaderName`, `SideNav`, `SideNavItems`, `SideNavLink`, `Breadcrumb` from `@carbon/react`
- Theme toggle state lives in a `ThemeContext` created in `src/main.tsx`
- MAS embedding guide: https://www.ibm.com/docs/en/mas-cd/continuous-delivery

---

## Integration Points Reference

The following are the clearly marked stub boundaries where real API calls will replace mock implementations:

| Service | Stub location | Real endpoint pattern |
|---|---|---|
| MVI inference | `src/services/mvi.service.ts` | `POST {VITE_MVI_BASE_URL}/api/v1/deployment/{deploymentId}/infer` |
| Maximo work order | `src/services/maximo.service.ts` | `POST {VITE_MAXIMO_BASE_URL}/maximo/oslc/os/mxwo` |
| Maximo assets | `src/services/maximo.service.ts` | `GET {VITE_MAXIMO_BASE_URL}/maximo/oslc/os/mxasset` |
| Inspection CRUD | `src/services/inspection.service.ts` | Replace `localStorage` with Maximo OSLC inspection object set |
| Auth | `src/services/auth.service.ts` | MAS IAM / SAML token exchange |
