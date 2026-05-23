import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'A valid email address is required.' })
  @IsNotEmpty()
  email!: string;
}
