import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiCenterSdkModule } from '@app/api-center';
import {
  CorrelationIdMiddleware,
  GatewayModule,
  HealthModule,
  validateEnv,
} from '@app/common';
import { SupabaseModule } from '@app/supabase';
import { NotificationsModule } from './notifications/notifications.module';

const shouldValidateEnv = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      cache: true,
      ...(shouldValidateEnv ? { validate: validateEnv } : {}),
    }),
    SupabaseModule,
    ApiCenterSdkModule,
    GatewayModule,
    HealthModule,
    NotificationsModule,
  ],
})
export class HopecardNotificationServiceModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
