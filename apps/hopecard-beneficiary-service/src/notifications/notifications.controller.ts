import { Controller, Get, Req } from '@nestjs/common';
import { RequirePersona } from '@app/common';
import { BeneficiaryNotificationsService } from './notifications.service';

@RequirePersona('beneficiary')
@Controller('hopecard/beneficiary/notifications')
export class BeneficiaryNotificationsController {
  constructor(
    private readonly notificationsService: BeneficiaryNotificationsService,
  ) {}

  @Get()
  getNotifications(@Req() req: any) {
    return this.notificationsService.getNotifications(req.user.sub);
  }
}
