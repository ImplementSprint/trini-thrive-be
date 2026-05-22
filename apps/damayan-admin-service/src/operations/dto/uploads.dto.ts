import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateDisasterCoverUploadDto {
  @IsString()
  disasterEventId: string;

  @IsString()
  fileName: string;

  @IsString()
  @IsOptional()
  contentType?: string;

  @IsNumber()
  @IsOptional()
  expiresIn?: number;
}

export class CreateIncidentAttachmentUploadDto {
  @IsString()
  incidentReportId: string;

  @IsString()
  fileName: string;

  @IsString()
  @IsOptional()
  contentType?: string;

  @IsNumber()
  @IsOptional()
  expiresIn?: number;
}

export class CreateObjectViewUrlDto {
  @IsString()
  bucket: string;

  @IsString()
  objectPath: string;

  @IsNumber()
  @IsOptional()
  expiresIn?: number;
}

export class CreateWarningBroadcastDto {
  @IsString()
  message: string;

  @IsString()
  @IsOptional()
  severity?: string;

  @IsString()
  @IsOptional()
  disasterId?: string;
}
