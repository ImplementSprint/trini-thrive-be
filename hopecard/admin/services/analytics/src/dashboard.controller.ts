import { Controller, Get } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";
import { Protected } from "@shared/protected.decorator";
import { DashboardMetrics } from "./interfaces/dashboard-metrics.interface";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /api/dashboard/metrics
   * Fetch dashboard metrics from database
   * Requires valid JWT authentication
   */
  @Get("metrics")
  @Protected()
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
