import { IsEmail, IsOptional, IsString } from 'class-validator';

export enum RecoveryMethod {
  EMAIL = 'email',
  SMS = 'sms',
}

export class ForgotPasswordDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  contact?: string;

  @IsString()
  @IsOptional()
  method?: RecoveryMethod;
}
