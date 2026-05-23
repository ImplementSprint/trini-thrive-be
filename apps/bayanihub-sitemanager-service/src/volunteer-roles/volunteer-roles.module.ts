import { Module } from '@nestjs/common';
import { VolunteerRolesController } from './volunteer-roles.controller';
import { VolunteerRolesService } from './volunteer-roles.service';

@Module({ controllers: [VolunteerRolesController], providers: [VolunteerRolesService] })
export class VolunteerRolesModule {}
