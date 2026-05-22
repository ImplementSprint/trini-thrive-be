import { Controller, Get, Query } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { RequirePersona } from '@app/common';

@Controller('hopecard/donor/campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get('public')
  getPublicCampaigns(@Query('category') category?: string, @Query('search') search?: string) {
    return this.campaignsService.getCampaigns(category, search);
  }

  @RequirePersona('donor')
  @Get()
  getCampaigns(@Query('category') category?: string, @Query('search') search?: string) {
    return this.campaignsService.getCampaigns(category, search);
  }
}
