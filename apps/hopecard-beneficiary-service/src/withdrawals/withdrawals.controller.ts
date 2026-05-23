import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { RequirePersona } from '@app/common';
import { WithdrawalsService } from './withdrawals.service';

interface AuthenticatedRequest {
  user: { sub: string };
}

@RequirePersona('beneficiary', 'hopecard')
@Controller('hopecard/beneficiary/withdrawals')
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Get()
  getWithdrawals(@Req() req: AuthenticatedRequest) {
    return this.withdrawalsService.getWithdrawals(req.user.sub);
  }

  @Post()
  requestWithdrawal(
    @Req() req: AuthenticatedRequest,
    @Body() body: { amount: number; bank_account_id?: string; notes?: string },
  ) {
    return this.withdrawalsService.requestWithdrawal(req.user.sub, body);
  }
}
