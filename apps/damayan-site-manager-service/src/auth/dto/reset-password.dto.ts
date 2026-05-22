import { IsOptional, IsString } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  verificationCode?: string;

  @IsString()
  newPassword: string;

  @IsString()
  contact: string;
}
