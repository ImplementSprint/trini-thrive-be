import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum RecoveryMethod {
  EMAIL = 'email',
  SMS = 'sms',
}

export class ForgotPasswordDto {
  @IsString()
  contact: string;

  @IsEnum(RecoveryMethod)
  @IsOptional()
  method?: RecoveryMethod;
}
