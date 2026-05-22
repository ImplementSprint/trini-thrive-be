import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsDateString,
  IsOptional,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'A valid email address is required.' })
  @IsNotEmpty()
  email!: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters.' })
  @MaxLength(72, { message: 'Password must not exceed 72 characters.' })
  password!: string;

  @IsString()
  @IsNotEmpty({ message: 'First name is required.' })
  @MaxLength(100)
  first_name!: string;

  @IsString()
  @IsNotEmpty({ message: 'Last name is required.' })
  @MaxLength(100)
  last_name!: string;

  @IsString()
  @IsNotEmpty({ message: 'Phone number is required.' })
  @Matches(/^\+?[\d\s\-()+]{7,20}$/, {
    message: 'Phone number must be a valid format.',
  })
  phone!: string;

  @IsDateString({}, { message: 'Date of birth must be a valid ISO date (YYYY-MM-DD).' })
  @IsNotEmpty()
  dob!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  barangay?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  municipality?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  province?: string;
}

export class LoginUserDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

export class VerifyOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class ResetPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  otp!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}
