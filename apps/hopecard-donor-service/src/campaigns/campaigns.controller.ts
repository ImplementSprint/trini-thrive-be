import { Controller, Get, Query, Param } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { RequirePersona } from '@app/common';

@Controller('hopecard/donor/campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get('public')
  getPublicCampaigns(@Query('category') category?: string, @Query('search') search?: string, @Query('limit') limit?: string) {
    return this.campaignsService.getCampaigns(category, search, limit ? Number(limit) : undefined);
  }

  @Get('public/:id')
  getPublicCampaignById(@Param('id') id: string) {
    return this.campaignsService.getCampaignById(id);
  }

  @RequirePersona('donor', 'hopecard')
  @Get()
  getCampaigns(@Query('category') category?: string, @Query('search') search?: string, @Query('limit') limit?: string) {
    return this.campaignsService.getCampaigns(category, search, limit ? Number(limit) : undefined);
  }

  @RequirePersona('donor', 'hopecard')
  @Get(':id')
  getCampaignById(@Param('id') id: string) {
    return this.campaignsService.getCampaignById(id);
  }
}
