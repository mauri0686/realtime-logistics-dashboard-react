export type ShipmentStatus =
  | 'Created'
  | 'PickedUp'
  | 'InTransit'
  | 'OutForDelivery'
  | 'Delivered'
  | 'Delayed'
  | 'Exception';

export type Priority = 'Standard' | 'Express' | 'Overnight';

/** Mirrors the API's Shipment record. Rows are immutable — updates arrive as new objects. */
export interface Shipment {
  id: string;
  carrier: string;
  origin: string;
  destination: string;
  customer: string;
  status: ShipmentStatus;
  lat: number;
  lng: number;
  progressPct: number;
  etaMinutes: number;
  weightKg: number;
  priority: Priority;
  lastUpdated: string;
}

export const ALL_STATUSES: readonly ShipmentStatus[] = [
  'Created',
  'PickedUp',
  'InTransit',
  'OutForDelivery',
  'Delivered',
  'Delayed',
  'Exception',
];

export interface LoginResponse {
  token: string;
  username: string;
  expiresAt: string;
}
