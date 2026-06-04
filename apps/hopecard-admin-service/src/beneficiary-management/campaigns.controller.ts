import { Controller, Get, Query } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { RequirePersona } from '@app/common';

@RequirePersona('admin', 'hopecard')
@Controller('api/v1/hopecard/admin/campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  async getAllCampaigns(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.campaignsService.getAllCampaigns(Number.parseInt(page, 10), Number.parseInt(limit, 10));
  }
}
