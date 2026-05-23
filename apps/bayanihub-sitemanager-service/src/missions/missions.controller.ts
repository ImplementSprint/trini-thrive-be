import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { RequirePersona } from '@app/common';
import { MissionsService, ActivateMissionDto } from './missions.service';

@RequirePersona('site-manager', 'bayanihub')
@Controller('api/v1/bayanihub/site-manager/missions')
export class MissionsController {
  constructor(private readonly service: MissionsService) {}

  @Post('activate')
  activate(@Body() dto: ActivateMissionDto & { activated_by?: string }) {
    const { activated_by, ...missionDto } = dto;
    return this.service.activateMission(missionDto, activated_by ?? 'site-manager');
  }

  @Post('assign')
  assignVolunteers(@Body() body: { application_ids: string[]; campaign_id: string; notes?: string }) {
    return this.service.assignVolunteers(body.application_ids, body.campaign_id, body.notes);
  }

  @Get('volunteer-summary')
  getVolunteerSummary(@Query('campaign_id') campaignId?: string) {
    return this.service.getVolunteerSummary(campaignId);
  }

  @Get('report')
  getFinalReport(@Query('campaign_id') campaignId?: string) {
    return this.service.getFinalReport(campaignId);
  }
}
