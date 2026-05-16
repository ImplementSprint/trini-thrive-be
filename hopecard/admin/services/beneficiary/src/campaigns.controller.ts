import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { JwtGuard } from '@shared/jwt.guard';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @UseGuards(JwtGuard)
  @Get()
  async getAllCampaigns(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.campaignsService.getAllCampaigns(parseInt(page, 10), parseInt(limit, 10));
  }
}
