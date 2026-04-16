import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsOptional,
  IsIP,
} from 'class-validator';
import { KitchenPrinterType } from '../../database/entities/printer.entity';

export class CreatePrinterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIP()
  ipAddress: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsEnum(KitchenPrinterType)
  type?: KitchenPrinterType;
}

export class UpdatePrinterDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsIP()
  ipAddress?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;
}
