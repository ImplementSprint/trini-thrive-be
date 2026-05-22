import { IsOptional, IsString } from 'class-validator';

export class CreateCheckInDto {
  @IsString()
  citizenId: string;

  @IsString()
  @IsOptional()
  disasterId?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ScanQrDto {
  @IsString()
  qrCode: string;

  @IsString()
  @IsOptional()
  disasterId?: string;

  @IsString()
  @IsOptional()
  location?: string;
}
