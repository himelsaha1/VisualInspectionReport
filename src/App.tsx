import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import AppShell from '@/components/AppShell'
import CaptureUploadPage from '@/features/capture/CaptureUploadPage'
import InspectionListPage from '@/features/inspection-list/InspectionListPage'
import AnalysisResultsPage from '@/features/results/AnalysisResultsPage'
import WorkOrderPage from '@/features/work-order/WorkOrderPage'
import DashboardPage from '@/features/dashboard/DashboardPage'
import SettingsPage from '@/features/settings/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          {/* Landing = capture flow */}
          <Route index element={<CaptureUploadPage />} />

          {/* Secondary pages reachable from hamburger drawer */}
          <Route path={ROUTES.INSPECTIONS} element={<InspectionListPage />} />
          <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />

          {/* Inspection detail routes */}
          <Route path={ROUTES.INSPECTION_ANALYSIS} element={<AnalysisResultsPage />} />
          <Route path={ROUTES.INSPECTION_WORK_ORDER} element={<WorkOrderPage />} />

          {/* Settings */}
          <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />

          {/* Legacy redirects */}
          <Route path={ROUTES.INSPECTION_NEW} element={<Navigate to="/" replace />} />
          <Route path={ROUTES.HISTORY} element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
