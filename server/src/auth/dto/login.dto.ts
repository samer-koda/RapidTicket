import { IsString, Length } from 'class-validator';

export class LoginDto {
  @IsString()
  @Length(4, 4)
  pin!: string;
}

export class BootstrapDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsString()
  @Length(4, 4)
  pin!: string;
}
