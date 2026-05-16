import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiCenterSdkModule } from './api-center/api-center-sdk.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { validateEnv } from './common/config/env.validation.js';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware.js';
import { HealthModule } from './health/health.module.js';
import { SupabaseModule } from './supabase/supabase.module.js';
import { LocationModule } from './location/location.module.js';
import { GatewayModule } from './gateway/gateway.module.js';
// Admin
import { AnalyticsModule } from './analytics/analytics.module.js';
import { ApprovalsModule } from './approvals/approvals.module.js';
import { AuthModule as AdminAuthModule } from './admin-auth/auth.module.js';
import { BeneficiariesModule } from './admin-beneficiary/beneficiaries.module.js';
// Beneficiary
import { AuthModule as BeneficiaryAuthModule } from './beneficiary-auth/auth.module.js';
import { HealthModule as BeneficiaryHealthModule } from './beneficiary-health/health.module.js';
// Campaign Manager
import { AuthModule as CmAuthModule } from './cm-auth/auth.module.js';
import { CampaignsModule as CmCampaignsModule } from './campaign-service/campaigns.module.js';
import { NotificationsModule } from './notification-service/notifications.module.js';
import { ReportingModule } from './reporting-service/reporting.module.js';
// Digital Donor
import { AuthModule as DonorAuthModule } from './donor-auth/auth.module.js';
import { CampaignsModule as DonorCampaignsModule } from './campaigns/campaigns.module.js';
import { CartModule } from './cart/cart.module.js';
import { ProfileModule } from './profile/profile.module.js';
import { PurchasesModule } from './purchases/purchases.module.js';

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
    LocationModule,
    GatewayModule,
    // Admin persona
    AnalyticsModule,
    ApprovalsModule,
    AdminAuthModule,
    BeneficiariesModule,
    // Beneficiary persona
    BeneficiaryAuthModule,
    BeneficiaryHealthModule,
    // Campaign Manager persona
    CmAuthModule,
    CmCampaignsModule,
    NotificationsModule,
    ReportingModule,
    // Digital Donor persona
    DonorAuthModule,
    DonorCampaignsModule,
    CartModule,
    ProfileModule,
    PurchasesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
