import { Body, Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { RequirePersona } from '@app/common';
import { CampaignsService } from './campaigns.service';
import { FilterCampaignsDto, UpdateCampaignDto } from './dto/campaigns.dto';

@RequirePersona('admin', 'bayanihub')
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get() findAll(@Query() filters: FilterCampaignsDto) { return this.campaignsService.findAll(filters); }
  @Get('stats') getStats() { return this.campaignsService.getStats(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.campaignsService.findOne(id); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateCampaignDto) { return this.campaignsService.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.campaignsService.remove(id); }
}
