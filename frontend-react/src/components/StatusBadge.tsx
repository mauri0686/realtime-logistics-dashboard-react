import { memo } from 'react';
import type { ShipmentStatus } from '../types/shipment';

const STATUS_CLASS: Record<ShipmentStatus, string> = {
  Created: 'muted',
  PickedUp: 'muted',
  InTransit: 'accent',
  OutForDelivery: 'info',
  Delivered: 'ok',
  Delayed: 'warn',
  Exception: 'bad',
};

const STATUS_LABEL: Record<ShipmentStatus, string> = {
  Created: 'Created',
  PickedUp: 'Picked up',
  InTransit: 'In transit',
  OutForDelivery: 'Out for delivery',
  Delivered: 'Delivered',
  Delayed: 'Delayed',
  Exception: 'Exception',
};

/** Tiny presentational component; memo — same status, same pill, no re-render. */
export const StatusBadge = memo(function StatusBadge({ status }: { status: ShipmentStatus }) {
  return <span className={`badge ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>;
});
