import { Controller, Get, Req } from '@nestjs/common';
import { RequirePersona } from '@app/common';
import { BeneficiaryNotificationsService } from './notifications.service';

interface AuthenticatedRequest {
  user: { sub: string };
}

@RequirePersona('beneficiary')
@Controller('hopecard/beneficiary/notifications')
export class BeneficiaryNotificationsController {
  constructor(
    private readonly notificationsService: BeneficiaryNotificationsService,
  ) {}

  @Get()
  getNotifications(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.getNotifications(req.user.sub);
  }
}
