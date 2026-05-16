import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsNumber()
  @IsNotEmpty()
  target_amount: number;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  cover_image_key?: string;

  @IsString()
  @IsOptional()
  status?: string;
}
