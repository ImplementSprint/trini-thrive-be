import { Controller, Delete, Get, Param, Patch } from '@nestjs/common';
import { RequirePersona } from '@app/common';
import { NotificationsService } from './notifications.service';

@RequirePersona('admin', 'bayanihub')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}
  @Get() findAll() { return this.notificationsService.findAll(); }
  @Patch(':id/read') markAsRead(@Param('id') id: string) { return this.notificationsService.markAsRead(id); }
  @Delete() clearAll() { return this.notificationsService.clearAll(); }
}
