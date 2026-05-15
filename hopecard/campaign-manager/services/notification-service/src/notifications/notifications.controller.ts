import { Controller, Post, Body } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('send-email')
  async sendEmail(@Body() body: { to: string; subject: string; html: string }) {
    return this.notificationsService.sendEmail(
      body.to,
      body.subject,
      body.html,
    );
  }
}
