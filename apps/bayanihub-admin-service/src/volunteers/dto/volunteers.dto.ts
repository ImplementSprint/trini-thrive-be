import { IsOptional, IsString } from 'class-validator';

export class FilterVolunteerRolesDto {
  @IsOptional() @IsString() campaign_id?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() search?: string;
}
