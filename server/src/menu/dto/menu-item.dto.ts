import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsBoolean,
  IsNumber,
  Min,
  IsOptional,
  IsInt,
} from 'class-validator';
import { MenuItemType, PrintDestination } from '../../database/entities/menu-item.entity';

export class CreateMenuItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUUID()
  categoryId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @IsEnum(MenuItemType)
  type: MenuItemType;

  @IsBoolean()
  isTaxable: boolean;

  @IsEnum(PrintDestination)
  printDestination: PrintDestination;

  @IsBoolean()
  isAvailable: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateMenuItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @IsOptional()
  @IsEnum(MenuItemType)
  type?: MenuItemType;

  @IsOptional()
  @IsBoolean()
  isTaxable?: boolean;

  @IsOptional()
  @IsEnum(PrintDestination)
  printDestination?: PrintDestination;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
