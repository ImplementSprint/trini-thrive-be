import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @IsEmail()
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  email: string;

  @IsString()
  password: string;

  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean;
}
