import { Controller, Get, Patch, Delete, Param } from '@nestjs/common';
import { RequirePersona } from '@app/common';
import { NotificationsService } from './notifications.service';

@RequirePersona('site-manager', 'bayanihub')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll() {
    return this.notificationsService.findAll();
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Delete()
  clearAll() {
    return this.notificationsService.clearAll();
  }
}
