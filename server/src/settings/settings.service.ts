import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Setting } from '../database/entities/setting.entity';
import { UpdateTaxRateDto, UpdateLockoutDto } from './dto/settings.dto';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepo: Repository<Setting>,
    private readonly dataSource: DataSource,
    private readonly authService: AuthService,
  ) {}

  async getTaxRate() {
    const s = await this.get('tax_rate');
    return { taxRate: parseFloat(s.value) };
  }

  async updateTaxRate(dto: UpdateTaxRateDto) {
    await this.set('tax_rate', String(dto.taxRate));
    return { taxRate: dto.taxRate };
  }

  async getLockout() {
    const [threshold, duration] = await Promise.all([
      this.get('pin_lockout_threshold'),
      this.get('pin_lockout_duration'),
    ]);
    return {
      pinLockoutThreshold: parseInt(threshold.value, 10),
      pinLockoutDuration: parseInt(duration.value, 10),
    };
  }

  async updateLockout(dto: UpdateLockoutDto) {
    if (dto.pinLockoutThreshold !== undefined) {
      await this.set('pin_lockout_threshold', String(dto.pinLockoutThreshold));
    }
    if (dto.pinLockoutDuration !== undefined) {
      await this.set('pin_lockout_duration', String(dto.pinLockoutDuration));
    }
    return this.getLockout();
  }

  async listAll(): Promise<Setting[]> {
    return this.settingRepo.find();
  }

  async setSetting(key: string, value: string): Promise<Setting> {
    await this.set(key, value);
    return this.get(key);
  }

  private async get(key: string): Promise<Setting> {
    const s = await this.settingRepo.findOne({ where: { key } });
    if (!s) throw new NotFoundException(`Setting '${key}' not found`);
    return s;
  }

  async factoryReset(userId: string, pin: string): Promise<{ success: boolean }> {
    const valid = await this.authService.validatePin(userId, pin);
    if (!valid) throw new UnauthorizedException('Invalid PIN');

    await this.dataSource.query(`
      TRUNCATE TABLE
        "order_item_modifiers",
        "order_items",
        "payments",
        "orders",
        "menu_item_modifier_links",
        "menu_items",
        "categories",
        "modifiers",
        "seats",
        "tables",
        "floor_plans",
        "printers",
        "stations",
        "users"
      CASCADE
    `);
    // Restore seed defaults for settings
    await this.dataSource.query(`
      INSERT INTO "settings" ("key", "value") VALUES
        ('tax_rate', '0.0875'),
        ('pin_lockout_threshold', '5'),
        ('pin_lockout_duration', '300'),
        ('auto_logout', 'true')
      ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"
    `);
    return { success: true };
  }

  private async set(key: string, value: string): Promise<void> {
    await this.settingRepo.upsert({ key, value }, ['key']);
  }
}
