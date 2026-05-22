import { IsOptional, IsString } from 'class-validator';

export class UpsertAfterActionAssessmentDto {
  @IsString()
  disasterId: string;

  @IsString()
  @IsOptional()
  summary?: string;

  @IsString()
  @IsOptional()
  lessonsLearned?: string;

  @IsString()
  @IsOptional()
  recommendations?: string;

  @IsString()
  @IsOptional()
  status?: string;
}
