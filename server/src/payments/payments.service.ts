import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Payment, PaymentStatus } from '../database/entities/payment.entity';
import { Order, OrderStatus } from '../database/entities/order.entity';
import { OrderItem } from '../database/entities/order-item.entity';
import { Table } from '../database/entities/table.entity';
import { Setting } from '../database/entities/setting.entity';
import { CreatePaymentDto } from './dto/payment.dto';
import { EventBusService } from '../common/event-bus.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Table)
    private readonly tableRepo: Repository<Table>,
    @InjectRepository(Setting)
    private readonly settingRepo: Repository<Setting>,
    private readonly dataSource: DataSource,
    private readonly eventBus: EventBusService,
  ) {}

  async createPayment(dto: CreatePaymentDto, user: { id: string; role: string }) {
    const order = await this.orderRepo.findOne({
      where: { id: dto.orderId },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === OrderStatus.CLOSED) {
      throw new BadRequestException('Order is already closed');
    }
    if (user.role !== 'admin' && order.createdBy !== user.id) {
      throw new ForbiddenException('Only the order owner or an admin can close this ticket');
    }

    const taxRateSetting = await this.settingRepo.findOne({ where: { key: 'tax_rate' } });
    const taxRate = taxRateSetting ? parseFloat(taxRateSetting.value) : 0.0875;

    // Recompute authoritative totals from order items (source of truth)
    const items = await this.orderItemRepo.find({ where: { orderId: order.id } });

    let subtotal = 0;
    let taxableSubtotal = 0;

    for (const item of items) {
      const lineTotal = Number(item.unitPrice) * item.quantity;
      subtotal += lineTotal;
      if (item.isTaxable) taxableSubtotal += lineTotal;
    }

    const taxAmount = parseFloat((taxableSubtotal * taxRate).toFixed(2));
    const tipAmount = dto.tipAmount ?? 0;
    const total = parseFloat((subtotal + taxAmount + tipAmount).toFixed(2));

    return this.dataSource.transaction(async (em) => {
      const payment = em.create(Payment, {
        orderId: order.id,
        subtotal: parseFloat(subtotal.toFixed(2)),
        taxableSubtotal: parseFloat(taxableSubtotal.toFixed(2)),
        taxRate,
        taxAmount,
        tipAmount,
        total,
        method: dto.method,
        status: PaymentStatus.COMPLETED,
      });
      await em.save(Payment, payment);

      // Close order and free table
      await em
        .createQueryBuilder()
        .update(Order)
        .set({ status: OrderStatus.CLOSED })
        .where('id = :id', { id: order.id })
        .execute();
      await em.update(Table, { id: order.tableId }, { occupied: false });

      this.eventBus.emitPaymentCompleted({
        paymentId: payment.id,
        orderId: order.id,
        tableId: order.tableId,
        subtotal: payment.subtotal,
        taxableSubtotal: payment.taxableSubtotal,
        taxRate: payment.taxRate,
        taxAmount: payment.taxAmount,
        tipAmount: payment.tipAmount,
        total: payment.total,
        method: payment.method,
      });

      return {
        status: PaymentStatus.COMPLETED,
        subtotal: payment.subtotal,
        taxableSubtotal: payment.taxableSubtotal,
        taxRate: payment.taxRate,
        taxAmount: payment.taxAmount,
        tipAmount: payment.tipAmount,
        total: payment.total,
      };
    });
  }
}
