import { IsString, IsOptional, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  verificationCode?: string;

  @IsString()
  @MinLength(8)
  newPassword: string;

  @IsString()
  contact: string;
}
