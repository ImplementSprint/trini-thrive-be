import { IsEmail, IsNotEmpty, IsString, Length, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail({}, { message: 'A valid email address is required.' })
  @IsNotEmpty()
  email!: string;

  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits.' })
  otp!: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters.' })
  newPassword!: string;
}
