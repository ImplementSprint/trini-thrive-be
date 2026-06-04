import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { InternalKeyGuard } from '@app/common';
import { NotificationsService } from './notifications.service';

@Controller('api/v1/hopecard/notification/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @UseGuards(new InternalKeyGuard())
  @Post('send-email')
  async sendEmail(@Body() body: { to: string; subject: string; html: string }) {
    return this.notificationsService.sendEmail(
      body.to,
      body.subject,
      body.html,
    );
  }
}
