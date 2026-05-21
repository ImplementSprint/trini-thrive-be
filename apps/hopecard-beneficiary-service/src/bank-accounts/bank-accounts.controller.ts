import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { RequirePersona } from '@app/common';
import { BankAccountsService } from './bank-accounts.service';

@RequirePersona('beneficiary')
@Controller('hopecard/beneficiary/bank-accounts')
export class BankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  @Get()
  getAccounts(@Req() req: any) {
    return this.bankAccountsService.getAccounts(req.user.sub);
  }

  @Post()
  createAccount(@Req() req: any, @Body() body: { bank_name: string; account_holder_name: string; account_number: string }) {
    return this.bankAccountsService.createAccount(req.user.sub, body);
  }

  @Patch(':id')
  updateAccount(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.bankAccountsService.updateAccount(req.user.sub, id, body);
  }

  @Delete(':id')
  deleteAccount(@Req() req: any, @Param('id') id: string) {
    return this.bankAccountsService.deleteAccount(req.user.sub, id);
  }
}
