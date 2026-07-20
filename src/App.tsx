import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import AppShell from '@/components/AppShell'
import InspectionListPage from '@/features/inspection-list/InspectionListPage'
import CaptureUploadPage from '@/features/capture/CaptureUploadPage'
import AnalysisResultsPage from '@/features/results/AnalysisResultsPage'
import WorkOrderPage from '@/features/work-order/WorkOrderPage'
import HistoryPage from '@/features/history/HistoryPage'
import DashboardPage from '@/features/dashboard/DashboardPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<Navigate to={ROUTES.INSPECTIONS} replace />} />
          <Route path={ROUTES.INSPECTIONS} element={<InspectionListPage />} />
          <Route path={ROUTES.INSPECTION_NEW} element={<CaptureUploadPage />} />
          <Route path={ROUTES.INSPECTION_ANALYSIS} element={<AnalysisResultsPage />} />
          <Route path={ROUTES.INSPECTION_WORK_ORDER} element={<WorkOrderPage />} />
          <Route path={ROUTES.HISTORY} element={<HistoryPage />} />
          <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
