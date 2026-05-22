import { Controller, Get, Patch, Param, Req } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RequirePersona } from '@app/common';

@RequirePersona('donor')
@Controller('hopecard/donor/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getNotifications(@Req() req: any) {
    return this.notificationsService.getNotifications(req.user.sub);
  }

  @Patch('read-all')
  markAllRead(@Req() req: any) {
    return this.notificationsService.markAllRead(req.user.sub);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.notificationsService.markRead(id);
  }
}
