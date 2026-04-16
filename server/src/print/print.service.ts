import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as net from 'net';
import { Printer } from '../database/entities/printer.entity';
import { OrderItemEventData } from '../common/event-bus.service';

interface PrintJob {
  printerId: string;
  data: Buffer;
  label: string; // for dead-letter logging
}

@Injectable()
export class PrintService {
  private readonly logger = new Logger(PrintService.name);
  private readonly deadLetterQueue: PrintJob[] = [];

  constructor(
    @InjectRepository(Printer)
    private readonly printerRepo: Repository<Printer>,
  ) {}

  // ── Event listeners ──────────────────────────────────────────────────────────

  @OnEvent('order.created')
  async onOrderCreated(envelope: { data: { orderId: string; tableId: string; items: OrderItemEventData[] } }) {
    const kitchenItems = envelope.data.items.filter(i => i.printDestination === 'KITCHEN');
    if (!kitchenItems.length) return;
    const ticket = this.formatKitchenTicket(envelope.data.orderId, envelope.data.tableId, kitchenItems);
    await this.sendToAllKitchenPrinters(ticket, `order.created:${envelope.data.orderId}`);
  }

  @OnEvent('order.updated')
  async onOrderUpdated(envelope: { data: { orderId: string; tableId: string; newItems: OrderItemEventData[] } }) {
    const kitchenItems = envelope.data.newItems.filter(i => i.printDestination === 'KITCHEN');
    if (!kitchenItems.length) return;
    const ticket = this.formatKitchenTicket(envelope.data.orderId, envelope.data.tableId, kitchenItems);
    await this.sendToAllKitchenPrinters(ticket, `order.updated:${envelope.data.orderId}`);
  }

  // ── ESC/POS formatting ───────────────────────────────────────────────────────

  private formatKitchenTicket(orderId: string, tableId: string, items: OrderItemEventData[]): Buffer {
    const ESC = 0x1b;
    const GS = 0x1d;
    const LF = 0x0a;

    const lines: Buffer[] = [];

    const pushLine = (text: string) => lines.push(Buffer.from(text + '\n', 'utf8'));
    const pushRaw = (...bytes: number[]) => lines.push(Buffer.from(bytes));

    // Initialize printer
    pushRaw(ESC, 0x40); // ESC @ — reset

    // Double-width header
    pushRaw(ESC, 0x21, 0x20); // ESC ! — double height/width
    pushLine('*** KITCHEN ***');
    pushRaw(ESC, 0x21, 0x00); // back to normal

    pushLine(`Order: ${orderId.slice(0, 8).toUpperCase()}`);
    pushLine(`Table: ${tableId.slice(0, 8).toUpperCase()}`);
    pushLine(new Date().toLocaleTimeString());
    pushLine('--------------------------------');

    for (const item of items) {
      pushLine(`${item.quantity}x ${item.name}`);
      for (const mod of item.modifiers) {
        const prefix = mod.action === 'ADD' ? '  + ' : '  - ';
        pushLine(`${prefix}${mod.label}`);
      }
    }

    pushLine('--------------------------------');

    // Feed and cut
    pushRaw(LF, LF, LF, LF);
    pushRaw(GS, 0x56, 0x41, 0x10); // GS V A — full cut

    return Buffer.concat(lines);
  }

  // ── TCP delivery ─────────────────────────────────────────────────────────────

  private async sendToAllKitchenPrinters(data: Buffer, label: string) {
    const printers = await this.printerRepo.find({ where: { type: 'KITCHEN' as any } });
    if (!printers.length) {
      this.logger.warn('No KITCHEN printers configured — ticket dropped');
      return;
    }
    for (const printer of printers) {
      await this.sendWithRetry({ printerId: printer.id, data, label }, printer.ipAddress, printer.port);
    }
  }

  private async sendWithRetry(job: PrintJob, ip: string, port: number, attempt = 1): Promise<void> {
    try {
      await this.tcpSend(ip, port, job.data);
      this.logger.log(`Printed "${job.label}" → ${ip}:${port}`);
    } catch (err) {
      if (attempt >= 3) {
        this.logger.error(`Print failed after 3 attempts for "${job.label}" (${ip}:${port}): ${(err as Error).message}`);
        this.deadLetterQueue.push(job);
        this.logger.warn(`Dead-letter queue length: ${this.deadLetterQueue.length}`);
        return;
      }
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s
      this.logger.warn(`Print attempt ${attempt} failed for "${job.label}", retrying in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
      await this.sendWithRetry(job, ip, port, attempt + 1);
    }
  }

  private tcpSend(ip: string, port: number, data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      const timeout = 4000;

      socket.setTimeout(timeout);

      socket.connect(port, ip, () => {
        socket.write(data, (err) => {
          if (err) {
            socket.destroy();
            reject(err);
          } else {
            socket.end();
            resolve();
          }
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error(`TCP timeout after ${timeout}ms`));
      });

      socket.on('error', (err) => {
        socket.destroy();
        reject(err);
      });
    });
  }

  // ── Dead-letter inspection ───────────────────────────────────────────────────

  getDeadLetterQueue(): PrintJob[] {
    return this.deadLetterQueue;
  }

  clearDeadLetterQueue(): void {
    this.deadLetterQueue.length = 0;
  }
}
