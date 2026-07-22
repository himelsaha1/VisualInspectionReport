import { LineChart, GroupedBarChart } from '@carbon/charts-react'
import type { LineChartOptions, BarChartOptions } from '@carbon/charts'
import '@carbon/charts-react/styles.css'
import { DatePicker, DatePickerInput, Dropdown, Heading, Tile } from '@carbon/react'
import { KpiTile } from '@/components/KpiTile'
import { useDashboardData } from '@/hooks/useDashboardData'
import type { AssetType } from '@/types'
import './DashboardPage.scss'

const ASSET_TYPE_ITEMS = [
  { id: 'all', label: 'All asset types' },
  { id: 'pump', label: 'Pump' },
  { id: 'pipe', label: 'Pipe' },
  { id: 'tank', label: 'Tank' },
  { id: 'valve', label: 'Valve' },
  { id: 'conveyor', label: 'Conveyor' },
  { id: 'motor', label: 'Motor' },
]

export default function DashboardPage() {
  const { kpis, weeklyData, defectByAssetType, filters, setFilters } = useDashboardData()

  return (
    <div className="dashboard-page">
      <Heading style={{ marginBlockEnd: '1.5rem' }}>Reporting dashboard</Heading>

      {/* Filters */}
      <div className="dashboard-page__filters">
        <Dropdown
          id="dash-asset-type"
          titleText="Asset type"
          label="All asset types"
          items={ASSET_TYPE_ITEMS}
          itemToString={item => item?.label ?? ''}
          selectedItem={ASSET_TYPE_ITEMS.find(i => i.id === filters.assetType) ?? ASSET_TYPE_ITEMS[0]}
          onChange={({ selectedItem }) =>
            setFilters(f => ({ ...f, assetType: (selectedItem?.id ?? 'all') as AssetType | 'all' }))
          }
          style={{ minWidth: '11rem' }}
        />
        <div className="dashboard-page__datepicker">
          <DatePicker
            datePickerType="range"
            dateFormat="Y-m-d"
            onChange={([start, end]) => {
              setFilters(f => ({
                ...f,
                startDate: start ? start.toISOString().split('T')[0] : '',
                endDate: end ? end.toISOString().split('T')[0] : '',
              }))
            }}
          >
            <DatePickerInput id="dash-start" placeholder="Start date" labelText="Date range" size="md" />
            <DatePickerInput id="dash-end" placeholder="End date" labelText="End date" hideLabel size="md" />
          </DatePicker>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="dashboard-page__kpis">
        <KpiTile label="Total inspections" value={kpis.total} />
        <KpiTile label="Pass rate" value={kpis.passRate} unit="%" />
        <KpiTile label="Avg. confidence" value={kpis.avgConfidence} unit="%" />
        <KpiTile label="Work orders created" value={kpis.woCount} />
      </div>

      {/* Charts */}
      <div className="dashboard-page__charts">
        <Tile className="dashboard-page__chart-tile">
          <p className="dashboard-page__chart-title">Inspections per week</p>
          <LineChart
            data={weeklyData}
            options={{
              title: '',
              axes: {
                bottom: { title: 'Week', mapsTo: 'date', scaleType: 'labels' as const },
                left: { title: 'Count', mapsTo: 'value', scaleType: 'linear' as const },
              },
              curve: 'curveMonotoneX',
              height: '280px',
              legend: { enabled: true },
              color: { scale: { Passed: '#42be65', 'Failed/Rejected': '#da1e28' } },
            } as LineChartOptions}
          />
        </Tile>

        <Tile className="dashboard-page__chart-tile">
          <p className="dashboard-page__chart-title">Defect types by asset category</p>
          <GroupedBarChart
            data={defectByAssetType}
            options={{
              title: '',
              axes: {
                left: { title: 'Count', mapsTo: 'value', scaleType: 'linear' as const },
                bottom: { title: 'Asset type', mapsTo: 'key', scaleType: 'labels' as const },
              },
              height: '280px',
              legend: { enabled: true },
            } as BarChartOptions}
          />
        </Tile>
      </div>
    </div>
  )
}
