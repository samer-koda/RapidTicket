import { Controller, Get, Put, Patch, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SetSettingDto, UpdateTaxRateDto, UpdateLockoutDto, FactoryResetDto } from './dto/settings.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  listAll() {
    return this.settingsService.listAll();
  }

  @Put(':key')
  @Roles('admin')
  setSetting(@Param('key') key: string, @Body() dto: SetSettingDto) {
    return this.settingsService.setSetting(key, dto.value);
  }

  @Get('tax-rate')
  getTaxRate() {
    return this.settingsService.getTaxRate();
  }

  @Patch('tax-rate')
  @Roles('admin')
  updateTaxRate(@Body() dto: UpdateTaxRateDto) {
    return this.settingsService.updateTaxRate(dto);
  }

  @Get('lockout')
  getLockout() {
    return this.settingsService.getLockout();
  }

  @Patch('lockout')
  @Roles('admin')
  updateLockout(@Body() dto: UpdateLockoutDto) {
    return this.settingsService.updateLockout(dto);
  }

  @Post('factory-reset')
  @Roles('admin')
  factoryReset(@Req() req: { user: { id: string } }, @Body() dto: FactoryResetDto) {
    return this.settingsService.factoryReset(req.user.id, dto.pin);
  }
}
