import { IsUUID, IsEnum, IsOptional, IsNumber, Min } from 'class-validator';
import { PaymentMethod } from '../../database/entities/payment.entity';

export class CreatePaymentDto {
  @IsUUID()
  orderId: string;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  tipAmount?: number;
}
