import { Controller, Get, Query } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  getCampaigns(@Query('category') category?: string) {
    return this.campaignsService.getCampaigns(category);
  }
}
