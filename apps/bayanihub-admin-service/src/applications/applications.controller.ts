import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { RequirePersona } from '@app/common';
import type { JwtPayload } from '@app/common';
import { ApplicationsService } from './applications.service';
import { FilterApplicationsDto, ReviewApplicationDto } from './dto/applications.dto';

@RequirePersona('admin', 'bayanihub')
@Controller('api/v1/bayanihub/admin/applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  findAll(@Query() filters: FilterApplicationsDto) {
    return this.applicationsService.findAll(filters);
  }

  @Get('roles')
  getRoles(@Query('campaign_id') campaignId?: string) {
    return this.applicationsService.getRoles(campaignId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.applicationsService.findOne(id);
  }

  @Patch(':id/review')
  review(@Param('id') id: string, @Body() dto: ReviewApplicationDto, @Req() req: Request) {
    const user = (req as Request & { user: JwtPayload }).user;
    return this.applicationsService.review(id, dto, user.sub);
  }
}
