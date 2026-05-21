import { Controller, Get, Param, Post, Req } from '@nestjs/common';
import { RequirePersona } from '@app/common';
import { CampaignsService } from './campaigns.service';

@RequirePersona('beneficiary')
@Controller('hopecard/beneficiary/campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  getCampaigns(@Req() req: any) {
    return this.campaignsService.getCampaigns(req.user.sub);
  }

  @Get('invitations')
  getInvitations(@Req() req: any) {
    return this.campaignsService.getInvitations(req.user.sub);
  }

  @Get(':id')
  getCampaign(@Req() req: any, @Param('id') id: string) {
    return this.campaignsService.getCampaign(req.user.sub, id);
  }

  @Post('invitations/:id/accept')
  acceptInvitation(@Req() req: any, @Param('id') id: string) {
    return this.campaignsService.acceptInvitation(req.user.sub, id);
  }

  @Post('invitations/:id/decline')
  declineInvitation(@Req() req: any, @Param('id') id: string) {
    return this.campaignsService.declineInvitation(req.user.sub, id);
  }
}
