import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ApplicationStatus {
  SUBMITTED = 'submitted',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export class FilterApplicationsDto {
  @IsOptional() @IsString() role_id?: string;
  @IsOptional() @IsEnum(ApplicationStatus) status?: ApplicationStatus;
  @IsOptional() @IsString() search?: string;
}

export class ReviewApplicationDto {
  @IsOptional() @IsEnum(ApplicationStatus) status?: ApplicationStatus;
  @IsOptional() @IsString() rejection_reason?: string;
  @IsOptional() @IsString() internal_notes?: string;
}
