import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { DigitalDonorApprovalsService } from './digital-donor-approvals.service';
import { Protected } from '@shared/protected.decorator';

@Controller('approvals/digital-donors')
export class DigitalDonorApprovalsController {
  constructor(private readonly approvalsService: DigitalDonorApprovalsService) {}

  /**
   * GET /api/approvals/digital-donors
   * Get all digital donor approvals with pagination
   */
  @Get()
  @Protected()
  async getAllApprovals(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, parseInt(limit) || 10);
    const result = await this.approvalsService.getAllApprovals(pageNum, limitNum);
    return {
      success: true,
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  /**
   * POST /api/approvals/digital-donors/:id/approve
   * Approve a digital donor application
   */
  @Post(':id/approve')
  @Protected()
  async approveDonor(
    @Param('id') donorId: string,
    @Body() body: { adminId: string },
  ) {
    const result = await this.approvalsService.approveDonor(
      donorId,
      body.adminId,
    );
    return result;
  }

  /**
   * POST /api/approvals/digital-donors/:id/reject
   * Reject a digital donor application
   */
  @Post(':id/reject')
  @Protected()
  async rejectDonor(
    @Param('id') donorId: string,
    @Body() body: { adminId: string; reason?: string },
  ) {
    const result = await this.approvalsService.rejectDonor(
      donorId,
      body.adminId,
      body.reason,
    );
    return result;
  }

  /**
   * GET /api/approvals/digital-donors/:id/history
   * Get approval history for a digital donor
   */
  @Get(':id/history')
  @Protected()
  async getApprovalHistory(@Param('id') donorId: string) {
    const history = await this.approvalsService.getApprovalHistory(donorId);
    return {
      success: true,
      data: history,
    };
  }
}
