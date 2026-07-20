import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  DataTable,
  DataTableSkeleton,
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
  Tile,
  Heading,
} from '@carbon/react'
import { Add } from '@carbon/icons-react'
import { useInspections } from '@/hooks/useInspections'
import { ROUTES } from '@/constants/routes'
import {
  STATUS_LABELS,
  STATUS_TAG_TYPE,
  INSPECTION_TYPE_LABELS,
} from '@/constants/status.constants'
import type { InspectionStatus } from '@/types'
import './InspectionListPage.scss'

const STATUS_FILTER_ITEMS = [
  { id: 'all', label: 'All statuses' },
  { id: 'pending', label: 'Pending' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'complete', label: 'Complete' },
  { id: 'approved', label: 'Approved' },
  { id: 'failed', label: 'Failed' },
  { id: 'rejected', label: 'Rejected' },
]

const HEADERS = [
  { key: 'assetName', header: 'Asset name' },
  { key: 'assetNum', header: 'Asset ID' },
  { key: 'inspectionType', header: 'Type' },
  { key: 'status', header: 'Status' },
  { key: 'createdAt', header: 'Date' },
  { key: 'workOrderId', header: 'Work order' },
]

export default function InspectionListPage() {
  const navigate = useNavigate()
  const { inspections, loading, error, refresh } = useInspections()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const rows = useMemo(() => {
    return inspections
      .filter(insp => {
        const matchesStatus = statusFilter === 'all' || insp.status === statusFilter
        const q = search.toLowerCase()
        const matchesSearch =
          !q ||
          insp.assetName.toLowerCase().includes(q) ||
          insp.assetNum.toLowerCase().includes(q) ||
          insp.inspectionType.toLowerCase().includes(q)
        return matchesStatus && matchesSearch
      })
      .map(insp => ({
        id: insp.id,
        assetName: insp.assetName,
        assetNum: insp.assetNum,
        inspectionType: INSPECTION_TYPE_LABELS[insp.inspectionType],
        status: insp.status,
        createdAt: new Date(insp.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        workOrderId: insp.workOrderId ?? '—',
      }))
  }, [inspections, search, statusFilter])

  if (loading) {
    return (
      <div className="inspection-list">
        <DataTableSkeleton headers={HEADERS} rowCount={8} />
      </div>
    )
  }

  return (
    <div className="inspection-list">
      <div className="inspection-list__header">
        <div>
          <Heading>Inspections</Heading>
          <p>Manage and review asset inspections powered by Maximo Visual Intelligence.</p>
        </div>
        <Button
          renderIcon={Add}
          onClick={() => navigate(ROUTES.INSPECTION_NEW)}
        >
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

      <DataTable rows={rows} headers={HEADERS}>
        {({
          rows: tableRows,
          headers,
          getTableProps,
          getHeaderProps,
          getRowProps,
          onInputChange,
        }) => (
          <TableContainer title="" description="">
            <TableToolbar>
              <TableToolbarContent>
                <TableToolbarSearch
                  placeholder="Search assets..."
                  onChange={(_e, value) => {
                    setSearch(value ?? '')
                    onInputChange(_e)
                  }}
                  persistent
                />
                <Dropdown
                  id="status-filter"
                  titleText=""
                  label="All statuses"
                  items={STATUS_FILTER_ITEMS}
                  itemToString={item => item?.label ?? ''}
                  selectedItem={
                    STATUS_FILTER_ITEMS.find(i => i.id === statusFilter) ??
                    STATUS_FILTER_ITEMS[0]
                  }
                  onChange={({ selectedItem }) =>
                    setStatusFilter(selectedItem?.id ?? 'all')
                  }
                  style={{ minWidth: '10rem' }}
                />
              </TableToolbarContent>
            </TableToolbar>

            {tableRows.length === 0 ? (
              <Tile className="inspection-list__empty">
                <Heading>No inspections found</Heading>
                <p className="inspection-list__empty-text">
                  {search || statusFilter !== 'all'
                    ? 'Try adjusting your search or filter.'
                    : 'Get started by clicking "Start inspection" above.'}
                </p>
              </Tile>
            ) : (
              <Table {...getTableProps()} useZebraStyles>
                <TableHead>
                  <TableRow>
                    {headers.map(header => (
                      <TableHeader
                        {...getHeaderProps({ header })}
                        key={header.key}
                      >
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
                          {cell.info.header === 'status' ? (
                            <Tag
                              type={
                                STATUS_TAG_TYPE[cell.value as InspectionStatus] as
                                  | 'gray'
                                  | 'blue'
                                  | 'teal'
                                  | 'red'
                                  | 'green'
                                  | 'magenta'
                              }
                              size="sm"
                            >
                              {STATUS_LABELS[cell.value as InspectionStatus]}
                            </Tag>
                          ) : (
                            cell.value
                          )}
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
