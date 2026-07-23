import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useShipmentsFeed } from '../hooks/useShipmentsFeed';
import { ALL_STATUSES, type ShipmentStatus } from '../types/shipment';
import { KpiCards, type FleetKpis } from '../components/KpiCards';
import { ShipmentsTable } from '../components/ShipmentsTable';

type StatusFilter = ShipmentStatus | 'All';

/**
 * Smart container: owns feed + filter state, derives view data with useMemo, and feeds dumb
 * memoised children. Derivations recompute only when their actual inputs change — the debounced
 * search text, not the raw keystrokes.
 */
export function DashboardPage() {
  const { username, logout } = useAuth();
  const navigate = useNavigate();
  const { shipments, status, updatesPerSec } = useShipmentsFeed();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const debouncedSearch = useDebouncedValue(search.trim().toLowerCase(), 200);

  const filtered = useMemo(() => {
    let rows = shipments;
    if (statusFilter !== 'All') rows = rows.filter((s) => s.status === statusFilter);
    if (debouncedSearch) {
      rows = rows.filter(
        (s) =>
          s.id.toLowerCase().includes(debouncedSearch) ||
          s.customer.toLowerCase().includes(debouncedSearch) ||
          s.origin.toLowerCase().includes(debouncedSearch) ||
          s.destination.toLowerCase().includes(debouncedSearch) ||
          s.carrier.toLowerCase().includes(debouncedSearch),
      );
    }
    return rows;
  }, [shipments, statusFilter, debouncedSearch]);

  const kpis = useMemo<FleetKpis>(() => {
    const count = (s: ShipmentStatus) => shipments.filter((r) => r.status === s).length;
    return {
      total: shipments.length,
      inTransit: count('InTransit'),
      outForDelivery: count('OutForDelivery'),
      delayed: count('Delayed') + count('Exception'),
      delivered: count('Delivered'),
    };
  }, [shipments]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="page">
      <header className="topbar panel">
        <div className="brand">
          <span className="logo">⬢</span>
          <div>
            <h1>
              ShipTrack <span>Ops</span>
            </h1>
            <p>Realtime logistics control tower</p>
          </div>
        </div>

        <div className="live">
          <span className={`dot ${status === 'live' ? 'on' : ''}`} />
          <span className="label">{status.toUpperCase()}</span>
          <span className="rate num">{updatesPerSec} upd/s</span>
        </div>

        <div className="user">
          <span>{username}</span>
          <button type="button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </header>

      <KpiCards kpis={kpis} />

      <section className="panel toolbar">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tracking #, customer, city, carrier…"
          aria-label="Search shipments"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Filter by status"
        >
          <option value="All">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="count num">{filtered.length} shipments</span>
      </section>

      <ShipmentsTable shipments={filtered} />
    </div>
  );
}
