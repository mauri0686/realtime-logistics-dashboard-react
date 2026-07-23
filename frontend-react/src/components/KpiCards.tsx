import { memo } from 'react';

export interface FleetKpis {
  total: number;
  inTransit: number;
  outForDelivery: number;
  delayed: number;
  delivered: number;
}

const fmt = new Intl.NumberFormat('en-US');

/**
 * Dumb presentational component. `memo` + a parent that builds `kpis` with `useMemo` means this
 * subtree re-renders only when the numbers actually change.
 */
export const KpiCards = memo(function KpiCards({ kpis }: { kpis: FleetKpis }) {
  return (
    <div className="kpis">
      <div className="panel kpi">
        <span className="value num">{fmt.format(kpis.total)}</span>
        <span className="label">Active shipments</span>
      </div>
      <div className="panel kpi accent">
        <span className="value num">{fmt.format(kpis.inTransit)}</span>
        <span className="label">In transit</span>
      </div>
      <div className="panel kpi info">
        <span className="value num">{fmt.format(kpis.outForDelivery)}</span>
        <span className="label">Out for delivery</span>
      </div>
      <div className="panel kpi bad">
        <span className="value num">{fmt.format(kpis.delayed)}</span>
        <span className="label">Delayed / exception</span>
      </div>
      <div className="panel kpi ok">
        <span className="value num">{fmt.format(kpis.delivered)}</span>
        <span className="label">Delivered (cycling)</span>
      </div>
    </div>
  );
});
