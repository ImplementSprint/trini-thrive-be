import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  reset_token!: string;

  @IsString()
  @MinLength(8)
  new_password!: string;
}
