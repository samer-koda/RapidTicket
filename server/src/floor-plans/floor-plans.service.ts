import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FloorPlan } from '../database/entities/floor-plan.entity';
import { Table } from '../database/entities/table.entity';
import { Seat } from '../database/entities/seat.entity';
import { CreateFloorPlanDto, UpdateFloorPlanDto } from './dto/floor-plan.dto';
import { CreateTableDto, UpdateTableDto, CreateSeatDto, UpdateSeatDto } from './dto/table.dto';

@Injectable()
export class FloorPlansService {
  constructor(
    @InjectRepository(FloorPlan)
    private readonly floorPlanRepo: Repository<FloorPlan>,
    @InjectRepository(Table)
    private readonly tableRepo: Repository<Table>,
    @InjectRepository(Seat)
    private readonly seatRepo: Repository<Seat>,
  ) {}

  // ── Floor Plans ──────────────────────────────────────────────────────────────

  getFloorPlans() {
    return this.floorPlanRepo.find({ order: { sortOrder: 'ASC' } });
  }

  async createFloorPlan(dto: CreateFloorPlanDto) {
    const fp = this.floorPlanRepo.create({ ...dto, sortOrder: dto.sortOrder ?? 0 });
    return this.floorPlanRepo.save(fp);
  }

  async updateFloorPlan(id: string, dto: UpdateFloorPlanDto) {
    const fp = await this.floorPlanRepo.findOne({ where: { id } });
    if (!fp) throw new NotFoundException('Floor plan not found');
    Object.assign(fp, dto);
    return this.floorPlanRepo.save(fp);
  }

  async deleteFloorPlan(id: string) {
    const fp = await this.floorPlanRepo.findOne({
      where: { id },
      relations: ['tables'],
    });
    if (!fp) throw new NotFoundException('Floor plan not found');
    if (fp.tables?.length) {
      throw new ConflictException('Cannot delete a floor plan that has tables assigned to it');
    }
    await this.floorPlanRepo.remove(fp);
    return { success: true };
  }

  // ── Tables ───────────────────────────────────────────────────────────────────

  async getTables(floorPlanId?: string) {
    const qb = this.tableRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.floorPlan', 'fp')
      .loadRelationCountAndMap('t.seatCount', 't.seats');

    if (floorPlanId) {
      qb.where('t.floor_plan_id = :floorPlanId', { floorPlanId });
    }

    const tables = await qb.getMany();

    return tables.map((t) => ({
      id: t.id,
      floorPlanId: t.floorPlanId,
      floorPlanName: t.floorPlan?.name,
      name: t.name,
      shape: t.shape,
      positionX: t.positionX,
      positionY: t.positionY,
      status: t.status,
      occupied: t.occupied,
      seatCount: (t as never as { seatCount: number }).seatCount ?? 0,
    }));
  }

  async createTable(dto: CreateTableDto) {
    const fp = await this.floorPlanRepo.findOne({ where: { id: dto.floorPlanId } });
    if (!fp) throw new NotFoundException('Floor plan not found');
    const table = this.tableRepo.create(dto);
    return this.tableRepo.save(table);
  }

  async updateTable(id: string, dto: UpdateTableDto) {
    const table = await this.tableRepo.findOne({ where: { id } });
    if (!table) throw new NotFoundException('Table not found');

    if (dto.floorPlanId) {
      const fp = await this.floorPlanRepo.findOne({ where: { id: dto.floorPlanId } });
      if (!fp) throw new NotFoundException('Floor plan not found');
    }

    Object.assign(table, dto);
    return this.tableRepo.save(table);
  }

  async deleteTable(id: string) {
    const table = await this.tableRepo.findOne({ where: { id } });
    if (!table) throw new NotFoundException('Table not found');

    // Per spec: only allowed if no open orders
    const openOrderCount = await this.tableRepo.manager
      .getRepository('orders')
      .count({ where: { table_id: id, status: 'OPEN' } } as never);

    if (openOrderCount > 0) {
      throw new ConflictException('Cannot delete a table with open orders');
    }

    await this.tableRepo.remove(table);
    return { success: true };
  }

  // ── Seats ────────────────────────────────────────────────────────────────────

  async getSeats(tableId: string) {
    const table = await this.tableRepo.findOne({ where: { id: tableId } });
    if (!table) throw new NotFoundException('Table not found');
    return this.seatRepo.find({ where: { tableId } });
  }

  async createSeat(tableId: string, dto: CreateSeatDto) {
    const table = await this.tableRepo.findOne({ where: { id: tableId } });
    if (!table) throw new NotFoundException('Table not found');
    const seat = this.seatRepo.create({ ...dto, tableId });
    return this.seatRepo.save(seat);
  }

  async updateSeat(tableId: string, seatId: string, dto: UpdateSeatDto) {
    const seat = await this.seatRepo.findOne({ where: { id: seatId, tableId } });
    if (!seat) throw new NotFoundException('Seat not found');
    Object.assign(seat, dto);
    return this.seatRepo.save(seat);
  }

  async deleteSeat(tableId: string, seatId: string) {
    const seat = await this.seatRepo.findOne({ where: { id: seatId, tableId } });
    if (!seat) throw new NotFoundException('Seat not found');
    await this.seatRepo.remove(seat);
    return { success: true };
  }
}
