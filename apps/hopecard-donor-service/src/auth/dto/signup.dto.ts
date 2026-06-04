import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class SignupDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  first_name!: string;

  @IsString()
  last_name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  barangay?: string;

  @IsOptional()
  @IsString()
  municipality?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  id_verification_key?: string;
}
