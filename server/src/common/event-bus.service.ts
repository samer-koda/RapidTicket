import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';

export interface OrderItemEventData {
  orderItemId: string;
  name: string;
  quantity: number;
  isTaxable: boolean;
  printDestination: string;
  modifiers: { action: string; label: string }[];
}

export interface OrderCreatedPayload {
  orderId: string;
  tableId: string;
  items: OrderItemEventData[];
}

export interface OrderUpdatedPayload {
  orderId: string;
  tableId: string;
  status: string;
  newItems: OrderItemEventData[];
}

export interface OrderItemStatusChangedPayload {
  orderId: string;
  orderItemId: string;
  status: string;
}

export interface PaymentCompletedPayload {
  paymentId: string;
  orderId: string;
  tableId: string;
  subtotal: number;
  taxableSubtotal: number;
  taxRate: number;
  taxAmount: number;
  tipAmount: number;
  total: number;
  method: string;
}

@Injectable()
export class EventBusService {
  constructor(private readonly emitter: EventEmitter2) {}

  emitOrderCreated(data: OrderCreatedPayload) {
    this.emitter.emit('order.created', this.envelope('order.created', data));
  }

  emitOrderUpdated(data: OrderUpdatedPayload) {
    this.emitter.emit('order.updated', this.envelope('order.updated', data));
  }

  emitOrderItemStatusChanged(data: OrderItemStatusChangedPayload) {
    this.emitter.emit(
      'order.item_status_changed',
      this.envelope('order.item_status_changed', data),
    );
  }

  emitPaymentCompleted(data: PaymentCompletedPayload) {
    this.emitter.emit(
      'payment.completed',
      this.envelope('payment.completed', data),
    );
  }

  private envelope(event: string, data: unknown) {
    return {
      event,
      version: 1,
      timestamp: new Date().toISOString(),
      id: uuidv4(),
      data,
    };
  }
}
