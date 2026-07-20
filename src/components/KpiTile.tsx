import { Tile } from '@carbon/react'
import './KpiTile.scss'

interface KpiTileProps {
  label: string
  value: string | number
  unit?: string
  delta?: string
}

export function KpiTile({ label, value, unit, delta }: KpiTileProps) {
  return (
    <Tile className="kpi-tile">
      <p className="kpi-tile__label">{label}</p>
      <p className="kpi-tile__value">
        {value}
        {unit && <span style={{ fontSize: '1rem', fontWeight: 400, marginInlineStart: '0.25rem' }}>{unit}</span>}
      </p>
      {delta && <p className="kpi-tile__delta">{delta}</p>}
    </Tile>
  )
}
