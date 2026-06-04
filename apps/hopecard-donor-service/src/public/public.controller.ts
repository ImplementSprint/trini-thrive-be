import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { PublicService } from './public.service';

@UseGuards(ApiKeyGuard)
@Controller('api/v1/hopecard/public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  /**
   * GET /api/v1/hopecard/public/campaigns
   * Query params: category (optional), search (optional)
   */
  @Get('campaigns')
  getCampaigns(
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.publicService.getCampaigns(category, search);
  }

  /**
   * GET /api/v1/hopecard/public/campaigns/:id
   */
  @Get('campaigns/:id')
  getCampaign(@Param('id') id: string) {
    return this.publicService.getCampaign(id);
  }
}
