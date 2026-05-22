import { Controller, Get, Patch, Delete, Param, Req } from '@nestjs/common';
import { Request } from 'express';
import { RequirePersona } from '@app/common';
import { JwtPayload } from '@app/common';
import { NotificationsService } from './notifications.service';

@RequirePersona('enduser', 'bayanihub')
@Controller('api/v1/bayanihub/enduser/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@Req() req: Request) {
    const user = (req as Request & { user: JwtPayload }).user;
    return this.notificationsService.findAll(user.sub);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Delete()
  clearAll(@Req() req: Request) {
    const user = (req as Request & { user: JwtPayload }).user;
    return this.notificationsService.clearAll(user.sub);
  }
}
