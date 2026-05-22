import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export enum CampaignStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  DRAFT = 'draft',
}

export class FilterCampaignsDto {
  @IsOptional() @IsEnum(CampaignStatus) status?: CampaignStatus;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() org_id?: string;
  @IsOptional() @IsString() search?: string;
}

export class UpdateCampaignDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsNumber() target_amount?: number;
  @IsOptional() @IsEnum(CampaignStatus) status?: CampaignStatus;
}
