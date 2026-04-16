import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsInt,
  IsOptional,
} from 'class-validator';
import { TableShape } from '../../database/entities/table.entity';

export class CreateTableDto {
  @IsUUID()
  floorPlanId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(TableShape)
  shape: TableShape;

  @IsInt()
  positionX: number;

  @IsInt()
  positionY: number;
}

export class UpdateTableDto {
  @IsOptional()
  @IsUUID()
  floorPlanId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEnum(TableShape)
  shape?: TableShape;

  @IsOptional()
  @IsInt()
  positionX?: number;

  @IsOptional()
  @IsInt()
  positionY?: number;
}

export class CreateSeatDto {
  @IsString()
  @IsNotEmpty()
  label: string;
}

export class UpdateSeatDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  label?: string;
}
