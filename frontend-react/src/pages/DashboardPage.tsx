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

  // First-visit onboarding: dismissible banner + "how it works" modal, so any visitor
  // understands WHAT they are looking at and WHY it is technically interesting.
  const [introVisible, setIntroVisible] = useState(
    () => localStorage.getItem('shiptrack.intro') !== 'seen',
  );
  const [aboutOpen, setAboutOpen] = useState(false);
  const dismissIntro = () => {
    localStorage.setItem('shiptrack.intro', 'seen');
    setIntroVisible(false);
  };

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
          <button type="button" className="about-btn" onClick={() => setAboutOpen(true)}>
            How it works
          </button>
          <button type="button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </header>

      {introVisible && (
        <div className="intro panel">
          <p>
            👋 You're watching <b>5,000 simulated shipments</b> update in real time —{' '}
            <b>~350 rows/second</b> pushed over a live stream. Only the rows on screen exist in
            the DOM (<b>virtual scroll</b>), which is why it stays this smooth. Try the search,
            or sort the chaos with the status filter.
          </p>
          <div className="intro-actions">
            <button type="button" className="ghost" onClick={() => setAboutOpen(true)}>
              How it works
            </button>
            <button type="button" className="solid" onClick={dismissIntro}>
              Got it
            </button>
          </div>
        </div>
      )}

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

      {aboutOpen && (
        <div className="overlay" onClick={() => setAboutOpen(false)}>
          <div
            className="modal panel"
            role="dialog"
            aria-label="How this works"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>How this works</h2>
            <ul>
              <li>
                <b>What it is</b> — an operations dashboard for a fictional parcel carrier: every
                shipment in the network, live, in one screen.
              </li>
              <li>
                <b>Real-time</b> — the server pushes only the rows that changed (~350/sec) over a
                WebSocket; the UI merges deltas into an immutable snapshot. In this online demo
                the simulation runs in your browser; cloning the repo runs the real .NET 8 +
                SignalR backend.
              </li>
              <li>
                <b>Why it stays fast</b> — virtualization keeps ~30 of 5,000 rows in the DOM, rows
                are immutable so unchanged ones never re-render, and search input is debounced.
              </li>
              <li>
                <b>Auth</b> — JWT login, axios interceptors and protected routes; credentials come
                pre-filled here so you land one click away.
              </li>
            </ul>
            <div className="modal-actions">
              <a
                href="https://github.com/mauri0686/realtime-logistics-dashboard-react"
                target="_blank"
                rel="noopener noreferrer"
              >
                View the code on GitHub →
              </a>
              <button type="button" className="solid" onClick={() => setAboutOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
