import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Station, StationPrinterType } from '../database/entities/station.entity';
import { RegisterStationDto, SetDefaultFloorDto } from './dto/station.dto';

@Injectable()
export class StationsService {
  constructor(
    @InjectRepository(Station)
    private readonly stationRepo: Repository<Station>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterStationDto) {
    // Re-register is idempotent — upsert by MAC address
    let station = await this.stationRepo.findOne({
      where: { macAddress: dto.macAddress },
    });

    const secret = this.config.get<string>('JWT_SECRET', 'change-me');

    if (!station) {
      station = this.stationRepo.create({
        name: dto.stationName,
        macAddress: dto.macAddress,
        printerType: dto.printerType ?? StationPrinterType.NONE,
        printerName: dto.printerName ?? null,
        licenseToken: '', // set below
      });
    } else {
      station.name = dto.stationName;
      station.printerType = dto.printerType ?? StationPrinterType.NONE;
      station.printerName = dto.printerName ?? null;
    }

    // Save first to get an id
    await this.stationRepo.save(station);

    // Issue signed license token bound to mac + station id
    const licenseToken = this.jwtService.sign(
      { sub: station.id, mac: dto.macAddress, type: 'station-license' },
      { secret, expiresIn: '10y' },
    );

    station.licenseToken = licenseToken;
    await this.stationRepo.save(station);

    return { stationId: station.id, license: licenseToken };
  }

  getAll() {
    return this.stationRepo.find({ order: { createdAt: 'ASC' } });
  }

  async revoke(id: string) {
    const station = await this.stationRepo.findOne({ where: { id } });
    if (!station) throw new NotFoundException('Station not found');
    await this.stationRepo.remove(station);
    return { success: true };
  }

  async findOne(id: string) {
    const station = await this.stationRepo.findOne({ where: { id } });
    if (!station) throw new NotFoundException('Station not found');
    return station;
  }

  async setDefaultFloor(id: string, dto: SetDefaultFloorDto) {
    const station = await this.findOne(id);
    station.defaultFloorPlanId = dto.defaultFloorPlanId ?? null;
    await this.stationRepo.save(station);
    return station;
  }

  async validateLicense(macAddress: string, licenseToken: string): Promise<boolean> {
    const secret = this.config.get<string>('JWT_SECRET', 'change-me');
    try {
      const payload = this.jwtService.verify<{ mac: string; type: string }>(
        licenseToken,
        { secret },
      );
      if (payload.type !== 'station-license' || payload.mac !== macAddress) {
        return false;
      }
      const station = await this.stationRepo.findOne({
        where: { macAddress, licenseToken },
      });
      return !!station;
    } catch {
      return false;
    }
  }
}
