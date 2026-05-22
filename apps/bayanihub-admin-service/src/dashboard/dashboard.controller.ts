import { Controller, Get } from '@nestjs/common';
import { RequirePersona } from '@app/common';
import { DashboardService } from './dashboard.service';

@RequirePersona('admin', 'bayanihub')
@Controller('api/v1/bayanihub/admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}
  @Get() getDashboard() { return this.dashboardService.getDashboard(); }
  @Get('stats') getStats() { return this.dashboardService.getStats(); }
  @Get('recent-activity') getRecentActivity() { return this.dashboardService.getRecentActivity(); }
}
