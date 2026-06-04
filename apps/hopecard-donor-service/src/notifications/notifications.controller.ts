import { Controller, Get, Patch, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NotificationsService } from './notifications.service';
import { RequirePersona } from '@app/common';
import type { JwtPayload } from '@app/common';

@RequirePersona('donor', 'hopecard')
@Controller('api/v1/hopecard/donor/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getNotifications(@Req() req: Request & { user: JwtPayload }) {
    return this.notificationsService.getNotifications(req.user.sub);
  }

  @Patch('read-all')
  markAllRead(@Req() req: Request & { user: JwtPayload }) {
    return this.notificationsService.markAllRead(req.user.sub);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.notificationsService.markRead(id);
  }
}
