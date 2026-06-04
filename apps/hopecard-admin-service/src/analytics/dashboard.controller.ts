import { Controller, Get } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";
import { RequirePersona } from "@app/common";
import { DashboardMetrics } from "./interfaces/dashboard-metrics.interface";

@RequirePersona('admin', 'hopecard')
@Controller('api/v1/hopecard/admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /api/dashboard/metrics
   * Fetch dashboard metrics from database
   * Requires valid JWT authentication
   */
  @Get("metrics")

  async getMetrics(): Promise<{ success: boolean; data: DashboardMetrics }> {
    console.log("📊 Dashboard metrics endpoint hit");
    const data = await this.dashboardService.getDashboardMetrics();
    console.log("📊 Returning metrics:", data);
    return {
      success: true,
      data,
    };
  }
}
