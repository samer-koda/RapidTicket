import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { StationPrinterType } from '../../database/entities/station.entity';

export class RegisterStationDto {
  @IsString()
  @IsNotEmpty()
  stationName: string;

  @IsString()
  @IsNotEmpty()
  macAddress: string;

  @IsOptional()
  @IsEnum(StationPrinterType)
  printerType?: StationPrinterType;

  @IsOptional()
  @IsString()
  printerName?: string;
}

export class SetDefaultFloorDto {
  @IsOptional()
  @IsUUID()
  defaultFloorPlanId?: string | null;
}
