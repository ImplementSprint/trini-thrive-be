import { Controller, Get, Param, Query } from '@nestjs/common';
import { RequirePersona } from '@app/common';
import { VolunteersService } from './volunteers.service';
import { FilterVolunteerRolesDto } from './dto/volunteers.dto';

@RequirePersona('admin', 'bayanihub')
@Controller('volunteers')
export class VolunteersController {
  constructor(private readonly volunteersService: VolunteersService) {}
  @Get('roles') findRoles(@Query() filters: FilterVolunteerRolesDto) { return this.volunteersService.findRoles(filters); }
  @Get('roles/:id') findRole(@Param('id') id: string) { return this.volunteersService.findRole(id); }
  @Get('verify/:authUserId') verifyVolunteer(@Param('authUserId') authUserId: string) { return this.volunteersService.verifyVolunteer(authUserId); }
  @Get('search') search(@Query('q') q: string) { return this.volunteersService.searchVolunteers(q); }
  @Get('stats') getStats() { return this.volunteersService.getStats(); }
  @Get(':applicationId/deployments') getDeployments(@Param('applicationId') id: string) { return this.volunteersService.getDeployments(id); }
}
