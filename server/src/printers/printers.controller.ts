import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
} from '@nestjs/common';
import { PrintersService } from './printers.service';
import { CreatePrinterDto, UpdatePrinterDto } from './dto/printer.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('printers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrintersController {
  constructor(private readonly printersService: PrintersService) {}

  @Get()
  getAll() {
    return this.printersService.getAll();
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreatePrinterDto) {
    return this.printersService.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePrinterDto,
  ) {
    return this.printersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(200)
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.printersService.delete(id);
  }

  @Post(':id/test')
  @Roles('admin')
  @HttpCode(200)
  test(@Param('id', ParseUUIDPipe) id: string) {
    return this.printersService.testConnection(id);
  }
}
