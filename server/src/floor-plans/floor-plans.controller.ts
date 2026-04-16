import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
} from '@nestjs/common';
import { FloorPlansService } from './floor-plans.service';
import { CreateFloorPlanDto, UpdateFloorPlanDto } from './dto/floor-plan.dto';
import { CreateTableDto, UpdateTableDto, CreateSeatDto, UpdateSeatDto } from './dto/table.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class FloorPlansController {
  constructor(private readonly service: FloorPlansService) {}

  // ── Floor Plans ──────────────────────────────────────────────────────────────

  @Get('floor-plans')
  getFloorPlans() {
    return this.service.getFloorPlans();
  }

  @Post('floor-plans')
  @Roles('admin')
  createFloorPlan(@Body() dto: CreateFloorPlanDto) {
    return this.service.createFloorPlan(dto);
  }

  @Patch('floor-plans/:id')
  @Roles('admin')
  updateFloorPlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFloorPlanDto,
  ) {
    return this.service.updateFloorPlan(id, dto);
  }

  @Delete('floor-plans/:id')
  @Roles('admin')
  @HttpCode(200)
  deleteFloorPlan(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteFloorPlan(id);
  }

  // ── Tables ───────────────────────────────────────────────────────────────────

  @Get('tables')
  getTables(@Query('floorPlanId') floorPlanId?: string) {
    return this.service.getTables(floorPlanId);
  }

  @Post('tables')
  @Roles('admin')
  createTable(@Body() dto: CreateTableDto) {
    return this.service.createTable(dto);
  }

  @Patch('tables/:id')
  @Roles('admin')
  updateTable(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTableDto,
  ) {
    return this.service.updateTable(id, dto);
  }

  @Delete('tables/:id')
  @Roles('admin')
  @HttpCode(200)
  deleteTable(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteTable(id);
  }

  // ── Seats ────────────────────────────────────────────────────────────────────

  @Get('tables/:id/seats')
  getSeats(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getSeats(id);
  }

  @Post('tables/:id/seats')
  @Roles('admin')
  createSeat(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSeatDto,
  ) {
    return this.service.createSeat(id, dto);
  }

  @Patch('tables/:tableId/seats/:seatId')
  @Roles('admin')
  updateSeat(
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Param('seatId', ParseUUIDPipe) seatId: string,
    @Body() dto: UpdateSeatDto,
  ) {
    return this.service.updateSeat(tableId, seatId, dto);
  }

  @Delete('tables/:tableId/seats/:seatId')
  @Roles('admin')
  @HttpCode(200)
  deleteSeat(
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Param('seatId', ParseUUIDPipe) seatId: string,
  ) {
    return this.service.deleteSeat(tableId, seatId);
  }
}
