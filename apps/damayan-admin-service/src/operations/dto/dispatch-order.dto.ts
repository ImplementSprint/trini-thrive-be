import { IsOptional, IsString } from 'class-validator';

export class CreateDispatchOrderDto {
  @IsString()
  operationId: string;

  @IsString()
  organizationId: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  priority?: string;

  @IsString()
  @IsOptional()
  items?: string;
}

export class UpdateDispatchOrderDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
