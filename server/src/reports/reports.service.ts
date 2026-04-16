import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../database/entities/payment.entity';
import { Order, OrderStatus } from '../database/entities/order.entity';
import { Table } from '../database/entities/table.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Table)
    private readonly tableRepo: Repository<Table>,
  ) {}

  async getDailyReport(dateStr?: string) {
    const today = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const payments = await this.paymentRepo
      .createQueryBuilder('p')
      .where('p.created_at >= :today', { today })
      .andWhere('p.created_at < :tomorrow', { tomorrow })
      .andWhere("p.status = 'COMPLETED'")
      .getMany();

    const closedOrders = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.created_at >= :today', { today })
      .andWhere('o.created_at < :tomorrow', { tomorrow })
      .andWhere("o.status = 'CLOSED'")
      .getMany();

    const openOrders = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.created_at >= :today', { today })
      .andWhere('o.created_at < :tomorrow', { tomorrow })
      .andWhere("o.status != 'CLOSED'")
      .getMany();

    const totalOrders = closedOrders.length + openOrders.length;
    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.total), 0);
    const totalTax = payments.reduce((sum, p) => sum + Number(p.taxAmount), 0);
    const totalTips = payments.reduce((sum, p) => sum + Number(p.tipAmount), 0);
    const pendingRevenue = openOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const cashRevenue = payments
      .filter(p => p.method === 'CASH')
      .reduce((sum, p) => sum + Number(p.total), 0);
    const cardRevenue = payments
      .filter(p => p.method === 'CARD_EXTERNAL')
      .reduce((sum, p) => sum + Number(p.total), 0);

    const openTables = await this.tableRepo.count({ where: { occupied: true } });

    return {
      date: today.toISOString().slice(0, 10),
      totalOrders,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalTax: parseFloat(totalTax.toFixed(2)),
      totalTips: parseFloat(totalTips.toFixed(2)),
      pendingRevenue: parseFloat(pendingRevenue.toFixed(2)),
      cashRevenue: parseFloat(cashRevenue.toFixed(2)),
      cardRevenue: parseFloat(cardRevenue.toFixed(2)),
      openTables,
    };
  }

  async getTableReport() {
    const tables = await this.tableRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.floorPlan', 'fp')
      .getMany();

    const results = await Promise.all(
      tables.map(async (t) => {
        let openOrderTotal = 0;
        let openSince: string | null = null;

        if (t.occupied) {
          const openOrder = await this.orderRepo
            .createQueryBuilder('o')
            .where('o.table_id = :tableId', { tableId: t.id })
            .andWhere("o.status != 'CLOSED'")
            .orderBy('o.created_at', 'ASC')
            .getOne();

          if (openOrder) {
            openOrderTotal = Number(openOrder.total);
            openSince = openOrder.createdAt.toISOString();
          }
        }

        return {
          tableId: t.id,
          name: t.name,
          floorPlanId: t.floorPlanId,
          floorPlanName: t.floorPlan?.name ?? null,
          status: t.occupied ? 'Occupied' : 'Available',
          occupied: t.occupied,
          openOrderTotal,
          openSince,
        };
      }),
    );

    return results;
  }
}
