import { bootstrapHttpApp } from '@app/common';
import { HopecardNotificationServiceModule } from './notification-service.module';

void bootstrapHttpApp({
  module: HopecardNotificationServiceModule,
  loggerName: 'HopecardNotificationService',
  swaggerTitle: 'Hopecard Notification Service',
  swaggerDescription: 'Hopecard notification backend API',
  defaultPort: 4023,
});
