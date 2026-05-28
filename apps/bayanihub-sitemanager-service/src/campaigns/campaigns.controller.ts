import { Body, Controller, Get, Param, Post, Query, ParseUUIDPipe } from '@nestjs/common';
import { RequirePersona } from '@app/common';
import { CampaignsService } from './campaigns.service';

@RequirePersona('site-manager', 'bayanihub')
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly service: CampaignsService) {}

  @Get()
  findAll(@Query('type') type?: string, @Query('status') status?: string) {
    return this.service.findAll(type, status);
  }

  @Get('damayan-sources')
  getDamayanSources() {
    return this.service.getDamayanSources();
  }

  @Post('activate-damayan')
  activateDamayanMission(
    @Body() body: {
      source_type: 'relief_operation' | 'evacuation_center';
      source_id: string;
      mission_type?: 'donation' | 'volunteer';
      notes?: string;
      volunteers_needed?: number;
      donors_needed?: number;
      participant_limit?: number;
      role_limits?: Record<string, number>;
    },
  ) {
    return this.service.activateDamayanMission(body);
  }

  @Post(':id/close')
  close(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.closeCampaign(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }
}
