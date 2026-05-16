import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { CampaignManagerApprovalsService } from './campaign-manager-approvals.service';
import { Protected } from '@shared/protected.decorator';

@Controller('approvals/campaign-managers')
export class CampaignManagerApprovalsController {
  constructor(private readonly approvalsService: CampaignManagerApprovalsService) {}

  /**
   * GET /api/approvals/campaign-managers
   * Get all campaign manager approvals with pagination
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
   * POST /api/approvals/campaign-managers/:id/approve
   * Approve a campaign manager application
   */
  @Post(':id/approve')
  @Protected()
  async approveCampaignManager(
    @Param('id') campaignManagerId: string,
    @Body() body: { adminId: string },
  ) {
    const result = await this.approvalsService.approveCampaignManager(
      campaignManagerId,
      body.adminId,
    );
    return result;
  }

  /**
   * POST /api/approvals/campaign-managers/:id/reject
   * Reject a campaign manager application
   */
  @Post(':id/reject')
  @Protected()
  async rejectCampaignManager(
    @Param('id') campaignManagerId: string,
    @Body() body: { adminId: string; reason?: string },
  ) {
    const result = await this.approvalsService.rejectCampaignManager(
      campaignManagerId,
      body.adminId,
      body.reason,
    );
    return result;
  }

  /**
   * GET /api/approvals/campaign-managers/:id/history
   * Get approval history for a campaign manager
   */
  @Get(':id/history')
  @Protected()
  async getApprovalHistory(@Param('id') campaignManagerId: string) {
    const history = await this.approvalsService.getApprovalHistory(campaignManagerId);
    return {
      success: true,
      data: history,
    };
  }
}
