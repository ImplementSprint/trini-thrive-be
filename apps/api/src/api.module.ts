import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiCenterSdkModule } from '@app/api-center';
import { CorrelationIdMiddleware, validateEnv } from '@app/common';
import { SupabaseModule } from '@app/supabase';
import { ApiController } from './api.controller';
import { ApiService } from './api.service';
import { AuthModule as AdminAuthModule } from './admin-auth/auth.module';
import { BeneficiariesModule } from './admin-beneficiary/beneficiaries.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { AuthModule as BeneficiaryAuthModule } from './beneficiary-auth/auth.module';
import { HealthModule as BeneficiaryHealthModule } from './beneficiary-health/health.module';
import { CampaignsModule as CmCampaignsModule } from './campaign-service/campaigns.module';
import { CampaignsModule as DonorCampaignsModule } from './campaigns/campaigns.module';
import { CartModule } from './cart/cart.module';
import { AuthModule as CmAuthModule } from './cm-auth/auth.module';
import { AuthModule as DonorAuthModule } from './donor-auth/auth.module';
import { GatewayModule } from './gateway/gateway.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notification-service/notifications.module';
import { ProfileModule } from './profile/profile.module';
import { PurchasesModule } from './purchases/purchases.module';
import { ReportingModule } from './reporting-service/reporting.module';

const shouldValidateEnv = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
      ...(shouldValidateEnv ? { validate: validateEnv } : {}),
    }),
    SupabaseModule,
    HealthModule,
    ApiCenterSdkModule,
    GatewayModule,
    AnalyticsModule,
    ApprovalsModule,
    AdminAuthModule,
    BeneficiariesModule,
    BeneficiaryAuthModule,
    BeneficiaryHealthModule,
    CmAuthModule,
    CmCampaignsModule,
    NotificationsModule,
    ReportingModule,
    DonorAuthModule,
    DonorCampaignsModule,
    CartModule,
    ProfileModule,
    PurchasesModule,
  ],
  controllers: [ApiController],
  providers: [ApiService],
})
export class ApiModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
