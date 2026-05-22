import { bootstrapHttpApp } from '@app/common';
import { HopecardNotificationServiceModule } from './notification-service.module';

process.env.PORT = process.env.HOPECARD_NOTIFICATION_PORT ?? '3105';

void bootstrapHttpApp({
  module: HopecardNotificationServiceModule,
  loggerName: 'HopecardNotificationService',
  swaggerTitle: 'Hopecard Notification Service',
  swaggerDescription: 'Hopecard notification backend API',
  defaultPort: 3105,
});
