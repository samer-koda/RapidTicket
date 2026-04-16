import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../database/entities/user.entity';
import { Setting } from '../database/entities/setting.entity';
import { LoginDto, BootstrapDto } from './dto/login.dto';

interface LockoutEntry {
  failCount: number;
  lockedUntil: number | null; // epoch ms — null means indefinite
}

@Injectable()
export class AuthService {
  // Per-station lockout state keyed by stationId (X-Station-Id header)
  private readonly lockout = new Map<string, LockoutEntry>();

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Setting)
    private readonly settingRepo: Repository<Setting>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto, stationId: string): Promise<{ token: string; user: { id: string; name: string; role: string } }> {
    // Check station lockout before doing any bcrypt work
    await this.checkLockout(stationId);

    // Load all users and find match by PIN
    const users = await this.userRepo.find();

    let matchedUser: User | null = null;
    for (const u of users) {
      const matches = await bcrypt.compare(dto.pin, u.pinHash);
      if (matches) {
        matchedUser = u;
        break;
      }
    }

    if (!matchedUser) {
      // Record failed attempt against the station
      await this.recordFailedAttempt(stationId);
      throw new UnauthorizedException('Invalid PIN');
    }

    // Success — clear the station's lockout counter
    this.lockout.delete(stationId);

    const secret = this.config.get<string>('JWT_SECRET', 'change-me');
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN', '8h');

    const token = this.jwtService.sign(
      { sub: matchedUser.id, role: matchedUser.role },
      { secret, expiresIn: expiresIn as never },
    );

    return {
      token,
      user: { id: matchedUser.id, name: matchedUser.name, role: matchedUser.role },
    };
  }

  async adminResetLockout(stationId: string): Promise<void> {
    this.lockout.delete(stationId);
  }

  async validatePin(userId: string, pin: string): Promise<boolean> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return false;
    return bcrypt.compare(pin, user.pinHash);
  }

  async setupStatus(): Promise<{ needsSetup: boolean }> {
    const count = await this.userRepo.count();
    return { needsSetup: count === 0 };
  }

  async bootstrap(dto: BootstrapDto): Promise<{ token: string; user: { id: string; name: string; role: string } }> {
    const count = await this.userRepo.count();
    if (count > 0) {
      throw new ConflictException('Setup already complete — an admin account already exists');
    }
    const pinHash = await bcrypt.hash(dto.pin, 12);
    const user = this.userRepo.create({ name: dto.name, role: UserRole.ADMIN, pinHash });
    const saved = await this.userRepo.save(user) as User;

    const secret = this.config.get<string>('JWT_SECRET', 'change-me');
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN', '8h');
    const token = this.jwtService.sign(
      { sub: saved.id, role: saved.role },
      { secret, expiresIn: expiresIn as never },
    );
    return { token, user: { id: saved.id, name: saved.name, role: saved.role } };
  }

  private async recordFailedAttempt(stationId: string): Promise<void> {
    const threshold = await this.getSettingInt('pin_lockout_threshold', 5);
    const duration = await this.getSettingInt('pin_lockout_duration', 300);

    const entry = this.lockout.get(stationId) ?? { failCount: 0, lockedUntil: null };
    entry.failCount += 1;

    if (entry.failCount >= threshold) {
      entry.lockedUntil = duration === 0 ? null : Date.now() + duration * 1000;
    }

    this.lockout.set(stationId, entry);
  }

  private async checkLockout(stationId: string): Promise<void> {
    const entry = this.lockout.get(stationId);
    if (!entry || entry.failCount === 0) return;

    if (entry.lockedUntil === null) {
      // Indefinite lockout
      throw new ForbiddenException('Station locked — contact an admin to reset');
    }

    if (Date.now() < entry.lockedUntil) {
      const remaining = Math.ceil((entry.lockedUntil - Date.now()) / 1000);
      throw new ForbiddenException(`Too many failed attempts — try again in ${remaining}s`);
    }

    // Lockout expired, clear it
    this.lockout.delete(stationId);
  }

  private async getSettingInt(key: string, fallback: number): Promise<number> {
    const setting = await this.settingRepo.findOne({ where: { key } });
    if (!setting) return fallback;
    const parsed = parseInt(setting.value, 10);
    return isNaN(parsed) ? fallback : parsed;
  }
}

