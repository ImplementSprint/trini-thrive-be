import { Controller, Get, Post, Body } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { RequirePersona } from '@app/common';

@RequirePersona('cm', 'hopecard')
@Controller('api/v1/hopecard/cm/campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  async create(@Body() createCampaignDto: any) {
    return this.campaignsService.create(createCampaignDto);
  }

  @Get()
  async findAll() {
    return this.campaignsService.findAll();
  }
}
