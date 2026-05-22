import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateDistributionDto {
  @IsString()
  operationId: string;

  @IsString()
  @IsOptional()
  citizenId?: string;

  @IsString()
  @IsOptional()
  familyId?: string;

  @IsString()
  @IsOptional()
  items?: string;

  @IsDateString()
  @IsOptional()
  date?: string;
}

export class UpdateDistributionDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
