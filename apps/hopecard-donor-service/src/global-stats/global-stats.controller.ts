import { Controller, Get } from '@nestjs/common';
import { GlobalStatsService } from './global-stats.service';

@Controller('api/v1/hopecard/donor/global-stats')
export class GlobalStatsController {
  constructor(private readonly globalStatsService: GlobalStatsService) {}

  @Get()
  getStats() {
    return this.globalStatsService.getStats();
  }
}
