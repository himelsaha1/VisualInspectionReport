import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  DataTable,
  DataTableSkeleton,
  DatePicker,
  DatePickerInput,
  Dropdown,
  InlineNotification,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tag,
  Tabs,
  Tab,
  TabList,
  TabPanels,
  TabPanel,
  Tile,
  Heading,
} from '@carbon/react'
import { Add } from '@carbon/icons-react'
import { useInspections } from '@/hooks/useInspections'
import {
  STATUS_LABELS,
  STATUS_TAG_TYPE,
  INSPECTION_TYPE_LABELS,
} from '@/constants/status.constants'
import type { AssetType, InspectionStatus } from '@/types'
import './InspectionListPage.scss'

// ─── Active inspections tab constants ─────────────────────────────────────────

const STATUS_FILTER_ITEMS = [
  { id: 'all', label: 'All statuses' },
  { id: 'pending', label: 'Pending' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'complete', label: 'Complete' },
  { id: 'approved', label: 'Approved' },
  { id: 'failed', label: 'Failed' },
  { id: 'rejected', label: 'Rejected' },
]

const ACTIVE_HEADERS = [
  { key: 'assetName', header: 'Asset name' },
  { key: 'assetNum', header: 'Asset ID' },
  { key: 'inspectionType', header: 'Type' },
  { key: 'status', header: 'Status' },
  { key: 'createdAt', header: 'Date' },
  { key: 'workOrderId', header: 'Work order' },
]

// ─── History tab constants ─────────────────────────────────────────────────────

const ASSET_TYPE_ITEMS = [
  { id: 'all', label: 'All asset types' },
  { id: 'pump', label: 'Pump' },
  { id: 'pipe', label: 'Pipe' },
  { id: 'tank', label: 'Tank' },
  { id: 'valve', label: 'Valve' },
  { id: 'conveyor', label: 'Conveyor' },
  { id: 'motor', label: 'Motor' },
]

const ASSET_TYPE_BY_NUM: Record<string, AssetType> = {
  'BFP-001': 'pump', 'CWP-002': 'pump', 'LOP-009': 'pump',
  'HPP-003': 'pipe', 'DPH-010': 'pipe',
  'CST-004': 'tank', 'PWT-005': 'tank',
  'GV-006': 'valve',
  'CB-007': 'conveyor',
  'DM-008': 'motor',
}

const HISTORY_HEADERS = [
  { key: 'assetName', header: 'Asset name' },
  { key: 'assetNum', header: 'Asset ID' },
  { key: 'assetType', header: 'Asset type' },
  { key: 'inspectionType', header: 'Inspection type' },
  { key: 'status', header: 'Status' },
  { key: 'createdAt', header: 'Date' },
  { key: 'workOrderId', header: 'Work order' },
]

// ─── Shared status tag renderer ───────────────────────────────────────────────

function StatusTag({ value }: { value: InspectionStatus }) {
  return (
    <Tag
      type={STATUS_TAG_TYPE[value] as 'gray' | 'blue' | 'teal' | 'red' | 'green' | 'magenta'}
      size="sm"
    >
      {STATUS_LABELS[value]}
    </Tag>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InspectionListPage() {
  const navigate = useNavigate()
  const { inspections, loading, error, refresh } = useInspections()

  // Active tab state
  const [activeSearch, setActiveSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // History tab state
  const [histSearch, setHistSearch] = useState('')
  const [assetTypeFilter, setAssetTypeFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // ── Active inspections rows
  const activeRows = useMemo(() => {
    return inspections
      .filter(insp => {
        const matchesStatus = statusFilter === 'all' || insp.status === statusFilter
        const q = activeSearch.toLowerCase()
        return (
          matchesStatus &&
          (!q ||
            insp.assetName.toLowerCase().includes(q) ||
            insp.assetNum.toLowerCase().includes(q) ||
            insp.inspectionType.toLowerCase().includes(q))
        )
      })
      .map(insp => ({
        id: insp.id,
        assetName: insp.assetName,
        assetNum: insp.assetNum,
        inspectionType: INSPECTION_TYPE_LABELS[insp.inspectionType],
        status: insp.status,
        createdAt: new Date(insp.createdAt).toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric',
        }),
        workOrderId: insp.workOrderId ?? '—',
      }))
  }, [inspections, activeSearch, statusFilter])

  // ── History rows
  const historyRows = useMemo(() => {
    return inspections
      .filter(insp => {
        if (assetTypeFilter !== 'all' && ASSET_TYPE_BY_NUM[insp.assetNum] !== assetTypeFilter) return false
        const d = new Date(insp.createdAt)
        if (startDate && d < new Date(startDate)) return false
        if (endDate && d > new Date(endDate + 'T23:59:59Z')) return false
        const q = histSearch.toLowerCase()
        if (q && !insp.assetName.toLowerCase().includes(q) && !insp.assetNum.toLowerCase().includes(q)) return false
        return true
      })
      .map(insp => ({
        id: insp.id,
        assetName: insp.assetName,
        assetNum: insp.assetNum,
        assetType: ASSET_TYPE_BY_NUM[insp.assetNum] ?? '—',
        inspectionType: INSPECTION_TYPE_LABELS[insp.inspectionType],
        status: insp.status,
        createdAt: new Date(insp.createdAt).toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric',
        }),
        workOrderId: insp.workOrderId ?? '—',
      }))
  }, [inspections, histSearch, assetTypeFilter, startDate, endDate])

  if (loading) {
    return (
      <div className="inspection-list">
        <DataTableSkeleton headers={ACTIVE_HEADERS} rowCount={8} />
      </div>
    )
  }

  return (
    <div className="inspection-list">
      {/* Page header */}
      <div className="inspection-list__header">
        <div>
          <Heading>Past inspections</Heading>
          <p>Review and manage completed asset inspections.</p>
        </div>
        <Button renderIcon={Add} onClick={() => navigate('/')}>
          Start inspection
        </Button>
      </div>

      {error && (
        <InlineNotification
          kind="error"
          title="Error loading inspections"
          subtitle={error}
          onCloseButtonClick={refresh}
          style={{ marginBlockEnd: '1rem' }}
        />
      )}

      {/* ── Tabs: Inspections | History ── */}
      <Tabs>
        <TabList aria-label="Inspection views">
          <Tab>Active inspections</Tab>
          <Tab>History</Tab>
        </TabList>

        <TabPanels>
          {/* ── Tab 1: Active inspections ── */}
          <TabPanel>
            <DataTable rows={activeRows} headers={ACTIVE_HEADERS}>
              {({ rows: tableRows, headers, getTableProps, getHeaderProps, getRowProps, onInputChange }) => (
                <TableContainer title="" description="">
                  <TableToolbar>
                    <TableToolbarContent>
                      <TableToolbarSearch
                        placeholder="Search assets..."
                        onChange={(_e, value) => { setActiveSearch(value ?? ''); onInputChange(_e) }}
                        persistent
                      />
                      <Dropdown
                        id="status-filter"
                        titleText=""
                        label="All statuses"
                        items={STATUS_FILTER_ITEMS}
                        itemToString={item => item?.label ?? ''}
                        selectedItem={STATUS_FILTER_ITEMS.find(i => i.id === statusFilter) ?? STATUS_FILTER_ITEMS[0]}
                        onChange={({ selectedItem }) => setStatusFilter(selectedItem?.id ?? 'all')}
                        style={{ minWidth: '10rem' }}
                      />
                    </TableToolbarContent>
                  </TableToolbar>

                  {tableRows.length === 0 ? (
                    <Tile className="inspection-list__empty">
                      <Heading>No inspections found</Heading>
                      <p className="inspection-list__empty-text">
                        {activeSearch || statusFilter !== 'all'
                          ? 'Try adjusting your search or filter.'
                          : 'Get started by clicking "Start inspection" above.'}
                      </p>
                    </Tile>
                  ) : (
                    <Table {...getTableProps()} useZebraStyles>
                      <TableHead>
                        <TableRow>
                          {headers.map(header => (
                            <TableHeader {...getHeaderProps({ header })} key={header.key}>
                              {header.header}
                            </TableHeader>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {tableRows.map(row => (
                          <TableRow
                            {...getRowProps({ row })}
                            key={row.id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => navigate(`/inspections/${row.id}/results`)}
                          >
                            {row.cells.map(cell => (
                              <TableCell key={cell.id}>
                                {cell.info.header === 'status'
                                  ? <StatusTag value={cell.value as InspectionStatus} />
                                  : cell.value}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TableContainer>
              )}
            </DataTable>
          </TabPanel>

          {/* ── Tab 2: History ── */}
          <TabPanel>
            <DataTable rows={historyRows} headers={HISTORY_HEADERS} isSortable>
              {({ rows: tableRows, headers, getTableProps, getHeaderProps, getRowProps, onInputChange }) => (
                <TableContainer title="" description="">
                  <TableToolbar>
                    <TableToolbarContent>
                      <TableToolbarSearch
                        placeholder="Search assets..."
                        onChange={(_e, value) => { setHistSearch(value ?? ''); onInputChange(_e) }}
                        persistent
                      />
                      <Dropdown
                        id="history-asset-type"
                        titleText=""
                        label="All asset types"
                        items={ASSET_TYPE_ITEMS}
                        itemToString={item => item?.label ?? ''}
                        selectedItem={ASSET_TYPE_ITEMS.find(i => i.id === assetTypeFilter) ?? ASSET_TYPE_ITEMS[0]}
                        onChange={({ selectedItem }) => setAssetTypeFilter(selectedItem?.id ?? 'all')}
                        style={{ minWidth: '10rem' }}
                      />
                      <div className="inspection-list__datepicker">
                        <DatePicker
                          datePickerType="range"
                          dateFormat="Y-m-d"
                          onChange={([start, end]) => {
                            if (start) setStartDate(start.toISOString().split('T')[0])
                            if (end) setEndDate(end.toISOString().split('T')[0])
                            if (!start && !end) { setStartDate(''); setEndDate('') }
                          }}
                        >
                          <DatePickerInput id="hist-start" placeholder="Start date" labelText="" size="md" />
                          <DatePickerInput id="hist-end" placeholder="End date" labelText="" size="md" />
                        </DatePicker>
                      </div>
                    </TableToolbarContent>
                  </TableToolbar>

                  <Table {...getTableProps()} useZebraStyles>
                    <TableHead>
                      <TableRow>
                        {headers.map(h => (
                          <TableHeader {...getHeaderProps({ header: h })} key={h.key}>
                            {h.header}
                          </TableHeader>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tableRows.map(row => (
                        <TableRow {...getRowProps({ row })} key={row.id}>
                          {row.cells.map(cell => (
                            <TableCell key={cell.id}>
                              {cell.info.header === 'status'
                                ? <StatusTag value={cell.value as InspectionStatus} />
                                : cell.value}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DataTable>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  )
}
