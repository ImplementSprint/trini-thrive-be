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
import { AuthModule } from './auth/auth.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { GlobalStatsModule } from './global-stats/global-stats.module';
import { CartModule } from './cart/cart.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ProfileModule } from './profile/profile.module';
import { PurchasesModule } from './purchases/purchases.module';
import { WalletModule } from './wallet/wallet.module';
import { StoriesModule } from './stories/stories.module';
import { PublicModule } from './public/public.module';

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
    AuthModule,
    CampaignsModule,
    GlobalStatsModule,
    CartModule,
    NotificationsModule,
    ProfileModule,
    PurchasesModule,
    WalletModule,
    StoriesModule,
    PublicModule,
  ],
})
export class HopecardDonorServiceModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
