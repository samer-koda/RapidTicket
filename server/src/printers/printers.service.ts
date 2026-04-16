import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as net from 'net';
import { Printer, KitchenPrinterType } from '../database/entities/printer.entity';
import { CreatePrinterDto, UpdatePrinterDto } from './dto/printer.dto';

@Injectable()
export class PrintersService {
  constructor(
    @InjectRepository(Printer)
    private readonly printerRepo: Repository<Printer>,
  ) {}

  getAll() {
    return this.printerRepo.find();
  }

  async create(dto: CreatePrinterDto) {
    const printer = this.printerRepo.create({
      name: dto.name,
      ipAddress: dto.ipAddress,
      port: dto.port ?? 9100,
      type: dto.type ?? KitchenPrinterType.KITCHEN,
    });
    return this.printerRepo.save(printer);
  }

  async update(id: string, dto: UpdatePrinterDto) {
    const printer = await this.printerRepo.findOne({ where: { id } });
    if (!printer) throw new NotFoundException('Printer not found');
    Object.assign(printer, dto);
    return this.printerRepo.save(printer);
  }

  async delete(id: string) {
    const printer = await this.printerRepo.findOne({ where: { id } });
    if (!printer) throw new NotFoundException('Printer not found');
    await this.printerRepo.remove(printer);
    return { success: true };
  }

  async testConnection(id: string): Promise<{ reachable: boolean; latencyMs: number | null }> {
    const printer = await this.printerRepo.findOne({ where: { id } });
    if (!printer) throw new NotFoundException('Printer not found');

    const start = Date.now();
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = 3000;

      socket.setTimeout(timeout);

      socket.connect(printer.port, printer.ipAddress, () => {
        const latencyMs = Date.now() - start;
        socket.destroy();
        resolve({ reachable: true, latencyMs });
      });

      const fail = () => {
        socket.destroy();
        resolve({ reachable: false, latencyMs: null });
      };

      socket.on('error', fail);
      socket.on('timeout', fail);
    });
  }
}
