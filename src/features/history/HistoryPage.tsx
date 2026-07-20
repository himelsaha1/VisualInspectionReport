import { useMemo, useState } from 'react'
import {
  DataTable,
  DatePicker,
  DatePickerInput,
  Dropdown,
  Heading,
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
} from '@carbon/react'
import { useInspections } from '@/hooks/useInspections'
import {
  STATUS_LABELS,
  STATUS_TAG_TYPE,
  INSPECTION_TYPE_LABELS,
} from '@/constants/status.constants'
import type { AssetType, InspectionStatus } from '@/types'
import './HistoryPage.scss'

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

const HEADERS = [
  { key: 'assetName', header: 'Asset name' },
  { key: 'assetNum', header: 'Asset ID' },
  { key: 'assetType', header: 'Asset type' },
  { key: 'inspectionType', header: 'Inspection type' },
  { key: 'status', header: 'Status' },
  { key: 'createdAt', header: 'Date' },
  { key: 'workOrderId', header: 'Work order' },
]

export default function HistoryPage() {
  const { inspections, loading } = useInspections()
  const [search, setSearch] = useState('')
  const [assetTypeFilter, setAssetTypeFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const rows = useMemo(() => {
    return inspections
      .filter(insp => {
        if (assetTypeFilter !== 'all') {
          if (ASSET_TYPE_BY_NUM[insp.assetNum] !== assetTypeFilter) return false
        }
        const d = new Date(insp.createdAt)
        if (startDate && d < new Date(startDate)) return false
        if (endDate && d > new Date(endDate + 'T23:59:59Z')) return false
        const q = search.toLowerCase()
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
  }, [inspections, search, assetTypeFilter, startDate, endDate])

  return (
    <div className="history-page">
      <Heading style={{ marginBlockEnd: '1.5rem' }}>Inspection history</Heading>

      <DataTable rows={rows} headers={HEADERS} isSortable>
        {({ rows: tableRows, headers, getTableProps, getHeaderProps, getRowProps, onInputChange }) => (
          <TableContainer title="" description="">
            <TableToolbar>
              <TableToolbarContent>
                <TableToolbarSearch
                  placeholder="Search assets..."
                  onChange={(_e, value) => { setSearch(value ?? ''); onInputChange(_e) }}
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
                <DatePicker
                  datePickerType="range"
                  dateFormat="Y-m-d"
                  onChange={([start, end]) => {
                    if (start) setStartDate(start.toISOString().split('T')[0])
                    if (end) setEndDate(end.toISOString().split('T')[0])
                    if (!start && !end) { setStartDate(''); setEndDate('') }
                  }}
                >
                  <DatePickerInput id="history-start" placeholder="Start date" labelText="" size="md" />
                  <DatePickerInput id="history-end" placeholder="End date" labelText="" size="md" />
                </DatePicker>
              </TableToolbarContent>
            </TableToolbar>

            {loading ? null : (
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
                          {cell.info.header === 'status' ? (
                            <Tag
                              type={STATUS_TAG_TYPE[cell.value as InspectionStatus] as 'gray' | 'blue' | 'teal' | 'red' | 'green' | 'magenta'}
                              size="sm"
                            >
                              {STATUS_LABELS[cell.value as InspectionStatus]}
                            </Tag>
                          ) : cell.value}
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
    </div>
  )
}
