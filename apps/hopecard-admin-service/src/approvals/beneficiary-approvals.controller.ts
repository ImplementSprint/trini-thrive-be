import { Controller, Get, Post, Param, Body, Query, Req } from '@nestjs/common';
import { BeneficiaryApprovalsService } from './beneficiary-approvals.service';
import { Protected } from '@app/common/decorators/protected.decorator';

@Controller('approvals/beneficiaries')
export class BeneficiaryApprovalsController {
  constructor(private readonly approvalsService: BeneficiaryApprovalsService) {}

  /**
   * GET /api/approvals/beneficiaries
   * Get all beneficiary approvals with pagination
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
   * GET /api/approvals/beneficiaries/documents
   * Get all identity document approvals
   */
  @Get('documents')
  @Protected()
  async getDocumentApprovals(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, parseInt(limit) || 10);
    const result = await this.approvalsService.getDocumentApprovals(pageNum, limitNum);
    return {
      success: true,
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  /**
   * GET /api/approvals/beneficiaries/bank
   * Get all bank account approvals
   */
  @Get('bank')
  @Protected()
  async getBankApprovals(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, parseInt(limit) || 10);
    const result = await this.approvalsService.getBankApprovals(pageNum, limitNum);
    return {
      success: true,
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  /**
   * POST /api/approvals/beneficiaries/:id/approve
   * Approve a beneficiary application
   */
  @Post(':id/approve')
  @Protected()
  async approveBeneficiary(
    @Param('id') beneficiaryId: string,
    @Body() body: { adminId: string },
    @Req() req: any,
  ) {
    const adminEmail = req.user?.email || 'admin@hopecard.com';
    const result = await this.approvalsService.approveBeneficiary(
      beneficiaryId,
      body.adminId,
      adminEmail,
    );
    return result;
  }

  /**
   * POST /api/approvals/beneficiaries/:id/reject
   * Reject a beneficiary application
   */
  @Post(':id/reject')
  @Protected()
  async rejectBeneficiary(
    @Param('id') beneficiaryId: string,
    @Body() body: { adminId: string; reason?: string },
    @Req() req: any,
  ) {
    const adminEmail = req.user?.email || 'admin@hopecard.com';
    const result = await this.approvalsService.rejectBeneficiary(
      beneficiaryId,
      body.adminId,
      body.reason,
      adminEmail,
    );
    return result;
  }

  /**
   * GET /api/approvals/beneficiaries/:id/history
   * Get approval history for a beneficiary
   */
  @Get(':id/history')
  @Protected()
  async getApprovalHistory(@Param('id') beneficiaryId: string) {
    const history = await this.approvalsService.getApprovalHistory(beneficiaryId);
    return {
      success: true,
      data: history,
    };
  }

  /**
   * POST /api/approvals/beneficiaries/:id/donate
   * Send/process a donation to a beneficiary
   */
  @Post(':id/donate')
  @Protected()
  async sendDonation(
    @Param('id') beneficiaryId: string,
    @Body() body: { adminId: string; amount: number; campaign?: string; notes?: string },
    @Req() req: any,
  ) {
    const adminEmail = req.user?.email || 'admin@hopecard.com';
    const result = await this.approvalsService.sendDonation(
      beneficiaryId,
      body.adminId,
      {
        amount: body.amount,
        ...(body.campaign ? { campaign: body.campaign } : {}),
        ...(body.notes ? { notes: body.notes } : {}),
      },
      adminEmail,
    );
    return result;
  }

  /**
   * POST /api/approvals/beneficiaries/:id/documents/approve
   * Approve beneficiary documents
   */
  @Post(':id/documents/approve')
  @Protected()
  async approveDocument(
    @Param('id') beneficiaryId: string,
    @Body() body: { adminId: string },
    @Req() req: any,
  ) {
    const adminEmail = req.user?.email || 'admin@hopecard.com';
    const result = await this.approvalsService.approveDocument(
      beneficiaryId,
      body.adminId,
      adminEmail,
    );
    return result;
  }

  /**
   * POST /api/approvals/beneficiaries/:id/documents/reject
   * Reject beneficiary documents
   */
  @Post(':id/documents/reject')
  @Protected()
  async rejectDocument(
    @Param('id') beneficiaryId: string,
    @Body() body: { adminId: string; reason?: string },
    @Req() req: any,
  ) {
    const adminEmail = req.user?.email || 'admin@hopecard.com';
    const result = await this.approvalsService.rejectDocument(
      beneficiaryId,
      body.adminId,
      body.reason,
      adminEmail,
    );
    return result;
  }

  /**
   * POST /api/approvals/beneficiaries/:id/bank/approve
   * Approve beneficiary bank details
   */
  @Post(':id/bank/approve')
  @Protected()
  async approveBank(
    @Param('id') beneficiaryId: string,
    @Body() body: { adminId: string },
    @Req() req: any,
  ) {
    const adminEmail = req.user?.email || 'admin@hopecard.com';
    const result = await this.approvalsService.approveBank(
      beneficiaryId,
      body.adminId,
      adminEmail,
    );
    return result;
  }

  /**
   * POST /api/approvals/beneficiaries/:id/bank/reject
   * Reject beneficiary bank details
   */
  @Post(':id/bank/reject')
  @Protected()
  async rejectBank(
    @Param('id') beneficiaryId: string,
    @Body() body: { adminId: string; reason?: string },
    @Req() req: any,
  ) {
    const adminEmail = req.user?.email || 'admin@hopecard.com';
    const result = await this.approvalsService.rejectBank(
      beneficiaryId,
      body.adminId,
      body.reason,
      adminEmail,
    );
    return result;
  }
}
