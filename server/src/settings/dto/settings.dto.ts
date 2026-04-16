import { IsNumber, Min, IsInt, IsOptional, IsString, Length } from 'class-validator';

export class SetSettingDto {
  @IsString()
  value!: string;
}

export class FactoryResetDto {
  @IsString()
  @Length(4, 4)
  pin!: string;
}

export class UpdateTaxRateDto {
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  taxRate!: number;
}

export class UpdateLockoutDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  pinLockoutThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  pinLockoutDuration?: number;
}
