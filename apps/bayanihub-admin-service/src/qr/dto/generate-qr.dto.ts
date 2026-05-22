import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum QrType {
  DEPLOYMENT = 'deployment',
  DEPLOYMENT_INVENTORY = 'deployment_inventory',
  DROP_OFF = 'drop_off',
}

export class GenerateQrDto {
  @IsOptional() @IsString() application_id?: string;
  @IsOptional() @IsString() donation_id?: string;
  @IsEnum(QrType) qr_type!: QrType;
  @IsOptional() @IsString() campaign_id?: string;
}
