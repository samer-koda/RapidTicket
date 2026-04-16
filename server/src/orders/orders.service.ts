import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order, OrderStatus } from '../database/entities/order.entity';
import { OrderItem, OrderItemStatus } from '../database/entities/order-item.entity';
import { OrderItemModifier } from '../database/entities/order-item-modifier.entity';
import { MenuItem } from '../database/entities/menu-item.entity';
import { Modifier } from '../database/entities/modifier.entity';
import { Table } from '../database/entities/table.entity';
import { Setting } from '../database/entities/setting.entity';
import { CreateOrderDto, AddOrderItemsDto, UpdateOrderItemStatusDto } from './dto/order.dto';
import { EventBusService, OrderItemEventData } from '../common/event-bus.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,
    @InjectRepository(OrderItemModifier)
    private readonly modifierRepo: Repository<OrderItemModifier>,
    @InjectRepository(MenuItem)
    private readonly menuItemRepo: Repository<MenuItem>,
    @InjectRepository(Modifier)
    private readonly menuModifierRepo: Repository<Modifier>,
    @InjectRepository(Table)
    private readonly tableRepo: Repository<Table>,
    @InjectRepository(Setting)
    private readonly settingRepo: Repository<Setting>,
    private readonly dataSource: DataSource,
    private readonly eventBus: EventBusService,
  ) {}

  async getOrders(filters: { status?: OrderStatus; tableId?: string }) {
    const qb = this.orderRepo.createQueryBuilder('o').orderBy('o.created_at', 'DESC');

    if (filters.status) {
      qb.andWhere('o.status = :status', { status: filters.status });
    }
    if (filters.tableId) {
      qb.andWhere('o.table_id = :tableId', { tableId: filters.tableId });
    }

    return qb.getMany();
  }

  async getOrder(id: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['items', 'items.menuItem', 'items.appliedModifiers'],
    });
    if (!order) throw new NotFoundException('Order not found');

    const taxRate = await this.getTaxRate();

    return {
      id: order.id,
      tableId: order.tableId,
      createdBy: order.createdBy,
      status: order.status,
      subtotal: Number(order.subtotal),
      taxableSubtotal: Number(order.taxableSubtotal),
      taxAmount: Number(order.taxAmount),
      total: Number(order.total),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items.map((item) => ({
        id: item.id,
        name: item.menuItem?.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        isTaxable: item.isTaxable,
        printDestination: item.printDestination,
        notes: item.notes,
        status: item.status,
        appliedModifiers: item.appliedModifiers.map((m) => ({
          label: m.label,
          action: m.action,
          priceDelta: Number(m.priceDelta),
        })),
      })),
    };
  }

  async createOrder(dto: CreateOrderDto, userId: string) {
    const table = await this.tableRepo.findOne({ where: { id: dto.tableId } });
    if (!table) throw new NotFoundException('Table not found');

    const taxRate = await this.getTaxRate();

    return this.dataSource.transaction(async (em) => {
      // Build items
      const resolvedItems = await this.resolveItems(dto.items);

      // Compute totals
      const { subtotal, taxableSubtotal, taxAmount, total } =
        this.computeTotals(resolvedItems, taxRate);

      const order = em.create(Order, {
        tableId: dto.tableId,
        createdBy: userId,
        status: OrderStatus.SENT,
        subtotal,
        taxableSubtotal,
        taxAmount,
        total,
      });
      await em.save(Order, order);

      // Set table occupied
      await em.update(Table, { id: dto.tableId }, { occupied: true });

      // Persist order items + modifiers
      const savedItems = await this.persistItems(em, order.id, resolvedItems);

      // Publish event
      const eventItems = this.toEventItems(resolvedItems, savedItems);
      this.eventBus.emitOrderCreated({
        orderId: order.id,
        tableId: order.tableId,
        items: eventItems,
      });

      return { id: order.id, status: order.status };
    });
  }

  async addItems(orderId: string, dto: AddOrderItemsDto) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === OrderStatus.CLOSED) {
      throw new BadRequestException('Cannot add items to a closed order');
    }

    const taxRate = await this.getTaxRate();

    return this.dataSource.transaction(async (em) => {
      const resolvedItems = await this.resolveItems(dto.items);
      const { subtotal, taxableSubtotal, taxAmount, total } =
        this.computeTotals(resolvedItems, taxRate);

      // Add to existing order totals
      const updatedSubtotal = Number(order.subtotal) + subtotal;
      const updatedTaxable = Number(order.taxableSubtotal) + taxableSubtotal;
      const updatedTaxAmount = Number(order.taxAmount) + taxAmount;
      const updatedTotal = Number(order.total) + total;

      await em.update(Order, { id: orderId }, {
        subtotal: updatedSubtotal,
        taxableSubtotal: updatedTaxable,
        taxAmount: updatedTaxAmount,
        total: updatedTotal,
        status: OrderStatus.SENT,
      });

      const savedItems = await this.persistItems(em, orderId, resolvedItems);

      // Publish event with only newly added items
      const eventItems = this.toEventItems(resolvedItems, savedItems);
      this.eventBus.emitOrderUpdated({
        orderId,
        tableId: order.tableId,
        status: OrderStatus.SENT,
        newItems: eventItems,
      });

      return {
        id: orderId,
        status: OrderStatus.SENT,
        items: savedItems.map((item, i) => ({
          id: item.id,
          name: resolvedItems[i].menuItem.name,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          appliedModifiers: item.appliedModifiers.map((m) => ({
            label: m.label,
            action: m.action,
            priceDelta: Number(m.priceDelta),
          })),
          status: item.status,
        })),
      };
    });
  }

  async updateItemStatus(
    orderId: string,
    itemId: string,
    dto: UpdateOrderItemStatusDto,
  ) {
    const item = await this.itemRepo.findOne({
      where: { id: itemId, orderId },
    });
    if (!item) throw new NotFoundException('Order item not found');

    const invalidTransitions: Record<string, OrderItemStatus[]> = {
      [OrderItemStatus.NEW]: [],
      [OrderItemStatus.SENT]: [OrderItemStatus.PREPARING, OrderItemStatus.READY],
      [OrderItemStatus.PREPARING]: [OrderItemStatus.READY],
      [OrderItemStatus.READY]: [],
    };

    const allowed = invalidTransitions[item.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition item from ${item.status} to ${dto.status}`,
      );
    }

    item.status = dto.status;
    await this.itemRepo.save(item);

    this.eventBus.emitOrderItemStatusChanged({
      orderId,
      orderItemId: itemId,
      status: dto.status,
    });

    // Check if all items for this order are READY → auto-update order status
    const nonReadyCount = await this.itemRepo
      .createQueryBuilder('oi')
      .where('oi.order_id = :orderId', { orderId })
      .andWhere('oi.status != :status', { status: OrderItemStatus.READY })
      .getCount();

    if (nonReadyCount === 0) {
      await this.orderRepo.update({ id: orderId }, { status: OrderStatus.READY });
    }

    return { id: itemId, status: dto.status };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async resolveItems(rawItems: CreateOrderDto['items']) {
    return Promise.all(
      rawItems.map(async (raw) => {
        const menuItem = await this.menuItemRepo.findOne({
          where: { id: raw.menuItemId },
        });
        if (!menuItem) throw new NotFoundException(`Menu item ${raw.menuItemId} not found`);

        let modifiers: Modifier[] = [];
        if (raw.modifierIds?.length) {
          modifiers = await Promise.all(
            raw.modifierIds.map(async (mid) => {
              const mod = await this.menuModifierRepo.findOne({
                where: { id: mid },
              });
              if (!mod) {
                throw new NotFoundException(`Modifier ${mid} not found`);
              }
              return mod;
            }),
          );
        }

        return { raw, menuItem, modifiers };
      }),
    );
  }

  private computeTotals(
    items: { raw: { quantity: number }; menuItem: MenuItem; modifiers: Modifier[] }[],
    taxRate: number,
  ) {
    let subtotal = 0;
    let taxableSubtotal = 0;

    for (const { raw, menuItem, modifiers } of items) {
      const modDelta = modifiers.reduce((sum, m) => sum + Number(m.priceDelta), 0);
      const lineTotal = (Number(menuItem.price) + modDelta) * raw.quantity;
      subtotal += lineTotal;
      if (menuItem.isTaxable) taxableSubtotal += lineTotal;
    }

    const taxAmount = parseFloat((taxableSubtotal * taxRate).toFixed(2));
    const total = parseFloat((subtotal + taxAmount).toFixed(2));

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      taxableSubtotal: parseFloat(taxableSubtotal.toFixed(2)),
      taxAmount,
      total,
    };
  }

  private async persistItems(
    em: import('typeorm').EntityManager,
    orderId: string,
    resolvedItems: Awaited<ReturnType<typeof this.resolveItems>>,
  ): Promise<OrderItem[]> {
    const saved: OrderItem[] = [];

    for (const { raw, menuItem, modifiers } of resolvedItems) {
      const orderItem = em.create(OrderItem, {
        orderId,
        menuItemId: menuItem.id,
        quantity: raw.quantity,
        unitPrice: menuItem.price,
        isTaxable: menuItem.isTaxable,
        printDestination: menuItem.printDestination,
        notes: raw.notes ?? null,
        status: OrderItemStatus.SENT,
      });
      await em.save(OrderItem, orderItem);

      const appliedModifiers: OrderItemModifier[] = [];
      for (const mod of modifiers) {
        const oim = em.create(OrderItemModifier, {
          orderItemId: orderItem.id,
          modifierId: mod.id,
          label: mod.label,
          action: mod.action,
          priceDelta: mod.priceDelta,
        });
        await em.save(OrderItemModifier, oim);
        appliedModifiers.push(oim);
      }

      orderItem.appliedModifiers = appliedModifiers;
      saved.push(orderItem);
    }

    return saved;
  }

  private toEventItems(
    resolvedItems: Awaited<ReturnType<typeof this.resolveItems>>,
    savedItems: OrderItem[],
  ): OrderItemEventData[] {
    return resolvedItems.map((ri, i) => ({
      orderItemId: savedItems[i].id,
      name: ri.menuItem.name,
      quantity: ri.raw.quantity,
      isTaxable: ri.menuItem.isTaxable,
      printDestination: ri.menuItem.printDestination,
      modifiers: ri.modifiers.map((m) => ({ action: m.action, label: m.label })),
    }));
  }

  private async getTaxRate(): Promise<number> {
    const setting = await this.settingRepo.findOne({ where: { key: 'tax_rate' } });
    return setting ? parseFloat(setting.value) : 0.0875;
  }
}
