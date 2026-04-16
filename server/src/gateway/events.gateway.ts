import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: { origin: '*' } })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @OnEvent('order.created')
  onOrderCreated(envelope: unknown) {
    this.server.emit('order.created', envelope);
  }

  @OnEvent('order.updated')
  onOrderUpdated(envelope: unknown) {
    this.server.emit('order.updated', envelope);
  }

  @OnEvent('order.item_status_changed')
  onOrderItemStatusChanged(envelope: unknown) {
    this.server.emit('order.item_status_changed', envelope);
  }

  @OnEvent('payment.completed')
  onPaymentCompleted(envelope: unknown) {
    this.server.emit('payment.completed', envelope);
  }
}
