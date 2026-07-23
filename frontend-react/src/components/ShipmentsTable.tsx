import { memo } from 'react';
import { List, type RowComponentProps } from 'react-window';
import type { Shipment } from '../types/shipment';
import { StatusBadge } from './StatusBadge';

const fmtWeight = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function etaLabel(minutes: number): string {
  if (minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

/**
 * One virtualised row. `memo` matters here: react-window re-renders visible rows when the list
 * data prop changes, but memo lets unchanged rows (same object identity — rows are immutable)
 * bail out instantly.
 */
function RowInner({
  index,
  style,
  shipments,
}: RowComponentProps<{ shipments: Shipment[] }>) {
  const s = shipments[index];
  return (
    <div className="row body" style={style}>
      <span className="num id">{s.id}</span>
      <span>
        <StatusBadge status={s.status} />
      </span>
      <span className="route">
        {s.origin} <span className="arrow">➜</span> {s.destination}
      </span>
      <span className="dim">{s.customer}</span>
      <span className="dim">{s.carrier}</span>
      <span className="num right">{fmtWeight.format(s.weightKg)} kg</span>
      <span className="num right eta">{etaLabel(s.etaMinutes)}</span>
      <span className="progress">
        <span className="bar">
          <span className="fill" style={{ width: `${s.progressPct}%` }} />
        </span>
        <span className="num pct">{s.progressPct}%</span>
      </span>
    </div>
  );
}

// Cast keeps react-window's strict "returns ReactElement" contract intact through memo().
const Row = memo(RowInner) as unknown as typeof RowInner;

/**
 * The 5,000-row live table. Same three pillars as any high-volume list:
 * 1. Virtualisation (react-window) — only visible rows exist in the DOM.
 * 2. Stable identity — immutable rows let memo'd children skip work.
 * 3. Cheap updates — one new array per delta batch, not per-row state.
 */
export const ShipmentsTable = memo(function ShipmentsTable({
  shipments,
}: {
  shipments: Shipment[];
}) {
  return (
    <div className="panel table-host">
      <div className="thead row">
        <span>Tracking #</span>
        <span>Status</span>
        <span>Route</span>
        <span>Customer</span>
        <span>Carrier</span>
        <span className="right">Weight</span>
        <span className="right">ETA</span>
        <span>Progress</span>
      </div>
      <div className="viewport">
        <List
          rowComponent={Row}
          rowCount={shipments.length}
          rowHeight={46}
          rowProps={{ shipments }}
        />
      </div>
    </div>
  );
});
