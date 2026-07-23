import { useEffect, useSyncExternalStore } from 'react';
import {
  HubConnectionBuilder,
  LogLevel,
  type HubConnection,
} from '@microsoft/signalr';
import { API_BASE_URL, api, tokenStorage } from '../api/client';
import type { Shipment } from '../types/shipment';

export type StreamStatus = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'error';

export interface FeedState {
  shipments: Shipment[];
  status: StreamStatus;
  updatesPerSec: number;
}

/**
 * Module-level external store for the live feed, consumed via `useSyncExternalStore`.
 *
 * Why not useState/useEffect inside a component? Two senior-level reasons:
 * 1. The socket's lifetime must not be tied to any component's render cycle — remounts and
 *    StrictMode double-effects would otherwise churn connections (the classic "dashboard leaks
 *    subscriptions over time" bug). Ref-counted connect/release keeps exactly one socket.
 * 2. `useSyncExternalStore` gives React an immutable snapshot per change, which plays perfectly
 *    with memoised children — a delta batch produces ONE new state object per tick, not N.
 */
class ShipmentsFeedStore {
  private byId = new Map<string, Shipment>();
  private hub: HubConnection | null = null;
  private listeners = new Set<() => void>();
  private refCount = 0;
  private connectPromise: Promise<void> | null = null;
  private updateCounter = 0;
  private rateTimer?: ReturnType<typeof setInterval>;

  private state: FeedState = { shipments: [], status: 'idle', updatesPerSec: 0 };

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): FeedState => this.state;

  /**
   * Called by each consumer on mount; the first one opens the socket. Single-flight: concurrent
   * acquires (e.g. StrictMode's double-effect) share ONE connect promise instead of racing two
   * sockets — the subtle version of the "duplicate subscriptions" leak.
   */
  async acquire(): Promise<void> {
    this.refCount++;
    this.connectPromise ??= this.connect();
    await this.connectPromise;
  }

  private async connect(): Promise<void> {
    this.setState({ status: 'connecting' });
    try {
      const { data } = await api.get<Shipment[]>('/api/shipments');
      this.replaceAll(data);

      const hub = new HubConnectionBuilder()
        .withUrl(`${API_BASE_URL}/hubs/shipments`, {
          accessTokenFactory: () => tokenStorage.get() ?? '',
        })
        .withAutomaticReconnect()
        .configureLogging(LogLevel.Warning)
        .build();

      hub.on('ShipmentsUpdated', (updates: Shipment[]) => this.applyUpdates(updates));
      hub.onreconnecting(() => this.setState({ status: 'reconnecting' }));
      hub.onreconnected(async () => {
        // Deltas were missed while offline — resync the snapshot over the socket.
        const snapshot = await hub.invoke<Shipment[]>('GetSnapshot');
        this.replaceAll(snapshot);
        this.setState({ status: 'live' });
      });
      hub.onclose(() => {
        if (this.hub !== null) this.setState({ status: 'error' });
      });

      await hub.start();
      this.hub = hub;
      this.startRateMeter();
      this.setState({ status: 'live' });
    } catch {
      this.setState({ status: 'error' });
    }
  }

  /** Called by each consumer on unmount; the last one closes the socket. */
  release(): void {
    this.refCount = Math.max(0, this.refCount - 1);
    if (this.refCount > 0) return;
    // Let any in-flight connect settle first, then tear down only if still unwanted
    // (a quick remount — StrictMode — will have bumped refCount back up by then).
    void this.drainThenMaybeTeardown();
  }

  private async drainThenMaybeTeardown(): Promise<void> {
    try {
      await this.connectPromise;
    } catch {
      /* connect failures already reflected in state */
    }
    if (this.refCount > 0) return;

    this.connectPromise = null;
    if (this.rateTimer) clearInterval(this.rateTimer);
    this.rateTimer = undefined;
    if (this.hub) {
      const hub = this.hub;
      this.hub = null; // signal deliberate close to onclose
      void hub.stop();
    }
    this.byId.clear();
    this.state = { shipments: [], status: 'idle', updatesPerSec: 0 };
    this.emit();
  }

  private applyUpdates(updates: Shipment[]): void {
    for (const s of updates) this.byId.set(s.id, s);
    this.updateCounter += updates.length;
    this.setState({ shipments: [...this.byId.values()] });
  }

  private replaceAll(shipments: Shipment[]): void {
    this.byId.clear();
    for (const s of shipments) this.byId.set(s.id, s);
    this.setState({ shipments: [...this.byId.values()] });
  }

  private startRateMeter(): void {
    if (this.rateTimer) return;
    this.rateTimer = setInterval(() => {
      this.setState({ updatesPerSec: this.updateCounter });
      this.updateCounter = 0;
    }, 1000);
  }

  private setState(patch: Partial<FeedState>): void {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

const store = new ShipmentsFeedStore();

/** Live shipments feed: snapshot over REST, then WebSocket deltas. Safe under StrictMode. */
export function useShipmentsFeed(): FeedState {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);

  useEffect(() => {
    void store.acquire();
    return () => store.release();
  }, []);

  return state;
}
