import { Controller, Get, Query, Param } from '@nestjs/common';
import { ReportingService } from './reporting.service';

@Controller('reporting')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('dashboard/:authUserId')
  async getDashboardData(@Param('authUserId') authUserId: string) {
    return this.reportingService.getDashboardData(authUserId);
  }

  // Add more endpoints as needed
}
