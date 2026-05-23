import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail({}, { message: 'A valid email address is required.' })
  @IsNotEmpty()
  email!: string;

  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits.' })
  code!: string;
}
