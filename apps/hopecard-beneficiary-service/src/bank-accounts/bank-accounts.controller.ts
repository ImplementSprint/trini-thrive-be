import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { RequirePersona } from '@app/common';
import { BankAccountsService } from './bank-accounts.service';

interface AuthenticatedRequest {
  user: { sub: string };
}

@RequirePersona('beneficiary')
@Controller('hopecard/beneficiary/bank-accounts')
export class BankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  @Get()
  getAccounts(@Req() req: AuthenticatedRequest) {
    return this.bankAccountsService.getAccounts(req.user.sub);
  }

  @Post()
  createAccount(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      bank_name: string;
      account_holder_name: string;
      account_number: string;
    },
  ) {
    return this.bankAccountsService.createAccount(req.user.sub, body);
  }

  @Patch(':id')
  updateAccount(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body()
    body: Partial<{
      bank_name: string;
      account_holder_name: string;
      account_number: string;
      is_primary: boolean;
    }>,
  ) {
    return this.bankAccountsService.updateAccount(req.user.sub, id, body);
  }

  @Delete(':id')
  deleteAccount(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.bankAccountsService.deleteAccount(req.user.sub, id);
  }
}
