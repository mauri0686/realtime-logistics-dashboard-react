import type { Priority, Shipment, ShipmentStatus } from '../types/shipment';

/**
 * In-browser port of the backend's ShipmentDataService simulation, used in demo mode
 * (GitHub Pages) so the dashboard can run with zero infrastructure. Same shapes, same
 * tick semantics: ~350 changed rows per second out of a 5,000-shipment fleet.
 */
const CARRIERS = ['NovaExpress', 'Atlas Freight', 'BluePoint', 'Meridian Post', 'Vector Cargo'];

const CITIES: Array<[string, number, number]> = [
  ['New York', 40.71, -74.01], ['Los Angeles', 34.05, -118.24], ['Chicago', 41.88, -87.63],
  ['Houston', 29.76, -95.37], ['Phoenix', 33.45, -112.07], ['Seattle', 47.61, -122.33],
  ['Miami', 25.76, -80.19], ['Denver', 39.74, -104.99], ['Boston', 42.36, -71.06],
  ['Atlanta', 33.75, -84.39], ['Dallas', 32.78, -96.8], ['San Francisco', 37.77, -122.42],
  ['Portland', 45.52, -122.68], ['Nashville', 36.16, -86.78], ['Minneapolis', 44.98, -93.27],
  ['Detroit', 42.33, -83.05], ['Austin', 30.27, -97.74], ['Charlotte', 35.23, -80.84],
];

const FIRST = ['Alex', 'Sam', 'Jordan', 'Casey', 'Riley', 'Morgan', 'Taylor', 'Jamie', 'Avery', 'Drew'];
const LAST = ['Rivera', 'Chen', 'Patel', 'Novak', 'Silva', 'Klein', 'Moreau', 'Haas', 'Ortiz', 'Kim'];
const PRIORITIES: Priority[] = ['Standard', 'Standard', 'Standard', 'Express', 'Overnight'];

interface Route {
  oLat: number; oLng: number; dLat: number; dLng: number;
}

export class DemoShipmentGenerator {
  private readonly byId = new Map<string, Shipment>();
  private readonly routes = new Map<string, Route>();
  private seq = 0;

  constructor(count = 5000) {
    for (let i = 0; i < count; i++) {
      const s = this.newShipment(Math.floor(Math.random() * 101));
      this.byId.set(s.id, s);
    }
  }

  snapshot(): Shipment[] {
    return [...this.byId.values()];
  }

  /** One simulation step; returns only the changed rows (deltas), like the real stream. */
  tick(changes = 350): Shipment[] {
    const keys = [...this.byId.keys()];
    const now = new Date().toISOString();
    const updated: Shipment[] = [];

    for (let i = 0; i < changes; i++) {
      const key = keys[Math.floor(Math.random() * keys.length)];
      const s = this.byId.get(key);
      if (!s) continue;

      let next: Shipment;
      if (s.status === 'Delivered') {
        this.byId.delete(key);
        this.routes.delete(key);
        next = this.newShipment(0);
      } else {
        const step = s.priority === 'Overnight' ? 2 + Math.floor(Math.random() * 4)
          : s.priority === 'Express' ? 1 + Math.floor(Math.random() * 3)
          : Math.floor(Math.random() * 3);
        const progress = Math.min(100, s.progressPct + step);
        const roll = Math.random();
        const status: ShipmentStatus =
          progress >= 100 ? 'Delivered'
          : progress >= 90 ? 'OutForDelivery'
          : progress > 0 && roll < 0.015 ? 'Delayed'
          : progress > 0 && roll < 0.018 ? 'Exception'
          : progress > 5 ? 'InTransit'
          : 'PickedUp';
        const [lat, lng] = this.positionAt(key, progress, s);
        next = {
          ...s,
          progressPct: progress,
          status,
          lat,
          lng,
          etaMinutes: status === 'Delivered'
            ? 0
            : Math.max(1, (100 - progress) * 14 + Math.floor(Math.random() * 20) - 10),
          lastUpdated: now,
        };
      }
      this.byId.set(next.id, next);
      updated.push(next);
    }
    return updated;
  }

  private newShipment(progress: number): Shipment {
    const origin = CITIES[Math.floor(Math.random() * CITIES.length)];
    let dest = CITIES[Math.floor(Math.random() * CITIES.length)];
    while (dest[0] === origin[0]) dest = CITIES[Math.floor(Math.random() * CITIES.length)];

    const id = `SHP-${String(++this.seq).padStart(6, '0')}`;
    this.routes.set(id, { oLat: origin[1], oLng: origin[2], dLat: dest[1], dLng: dest[2] });

    return {
      id,
      carrier: CARRIERS[Math.floor(Math.random() * CARRIERS.length)],
      origin: origin[0],
      destination: dest[0],
      customer: `${FIRST[Math.floor(Math.random() * FIRST.length)]} ${LAST[Math.floor(Math.random() * LAST.length)]}`,
      status: progress === 0 ? 'Created' : progress >= 90 ? 'OutForDelivery' : progress > 5 ? 'InTransit' : 'PickedUp',
      lat: this.lerp(origin[1], dest[1], progress),
      lng: this.lerp(origin[2], dest[2], progress),
      progressPct: progress,
      etaMinutes: Math.max(1, (100 - progress) * 14),
      weightKg: Math.round((Math.random() * 48 + 0.2) * 10) / 10,
      priority: PRIORITIES[Math.floor(Math.random() * PRIORITIES.length)],
      lastUpdated: new Date().toISOString(),
    };
  }

  private positionAt(id: string, progress: number, current: Shipment): [number, number] {
    const r = this.routes.get(id);
    if (!r) return [current.lat, current.lng];
    return [this.lerp(r.oLat, r.dLat, progress), this.lerp(r.oLng, r.dLng, progress)];
  }

  private lerp(from: number, to: number, pct: number): number {
    return Math.round((from + ((to - from) * pct) / 100) * 1e4) / 1e4;
  }
}
