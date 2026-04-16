import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
} from '@nestjs/common';
import { StationsService } from './stations.service';
import { AuthService } from '../auth/auth.service';
import { RegisterStationDto, SetDefaultFloorDto } from './dto/station.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('stations')
export class StationsController {
  constructor(
    private readonly stationsService: StationsService,
    private readonly authService: AuthService,
  ) {}

  // Public — called during station install before a JWT is available
  @Post('register')
  register(@Body() dto: RegisterStationDto) {
    return this.stationsService.register(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getAll() {
    return this.stationsService.getAll();
  }

  // Any authenticated user can read their station's config (needed for default floor plan)
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.stationsService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(200)
  revoke(@Param('id', ParseUUIDPipe) id: string) {
    return this.stationsService.revoke(id);
  }

  @Patch(':id/default-floor')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  setDefaultFloor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetDefaultFloorDto,
  ) {
    return this.stationsService.setDefaultFloor(id, dto);
  }

  @Post(':id/reset-lockout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(200)
  async resetLockout(@Param('id', ParseUUIDPipe) id: string) {
    await this.authService.adminResetLockout(id);
    return { success: true };
  }
}
