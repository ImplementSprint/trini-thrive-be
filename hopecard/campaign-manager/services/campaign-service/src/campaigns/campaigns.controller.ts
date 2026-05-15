import { Controller, Get, Post, Body } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';

@Controller('api/campaigns')
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
