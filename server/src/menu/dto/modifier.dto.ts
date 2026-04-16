import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  Min,
  IsOptional,
  IsInt,
} from 'class-validator';
import { ModifierAction } from '../../database/entities/menu-item-modifier.entity';

export class CreateModifierDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsEnum(ModifierAction)
  action: ModifierAction;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  priceDelta: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateModifierDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  label?: string;

  @IsOptional()
  @IsEnum(ModifierAction)
  action?: ModifierAction;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  priceDelta?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
