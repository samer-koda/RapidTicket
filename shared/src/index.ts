// Shared enums and types used by both server and client

export enum UserRole {
  ADMIN = 'admin',
  SERVER = 'server',
  BARTENDER = 'bartender',
}

export enum TableShape {
  ROUND = 'ROUND',
  RECTANGLE = 'RECTANGLE',
}

export enum TableStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export enum OrderStatus {
  OPEN = 'OPEN',
  SENT = 'SENT',
  READY = 'READY',
  CLOSED = 'CLOSED',
}

export enum OrderItemStatus {
  NEW = 'NEW',
  SENT = 'SENT',
  PREPARING = 'PREPARING',
  READY = 'READY',
}

export enum MenuItemType {
  FOOD = 'FOOD',
  DRINK = 'DRINK',
}

export enum PrintDestination {
  KITCHEN = 'KITCHEN',
  BAR = 'BAR',
  NONE = 'NONE',
}

export enum ModifierAction {
  ADD = 'ADD',
  REMOVE = 'REMOVE',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD_EXTERNAL = 'CARD_EXTERNAL',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
}

export enum PrinterType {
  KITCHEN = 'KITCHEN',
}

export enum StationPrinterType {
  USB = 'USB',
  BLUETOOTH = 'BLUETOOTH',
  NONE = 'NONE',
}

// WebSocket event names
export const WS_EVENTS = {
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_ITEM_STATUS_CHANGED: 'order.item_status_changed',
  PAYMENT_COMPLETED: 'payment.completed',
} as const;

export type WsEventName = typeof WS_EVENTS[keyof typeof WS_EVENTS];

export interface WsEventEnvelope<T = unknown> {
  event: WsEventName;
  version: 1;
  timestamp: string;
  id: string;
  data: T;
}
