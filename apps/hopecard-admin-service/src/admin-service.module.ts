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
import { AnalyticsModule } from './analytics/analytics.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { AuthModule } from './auth/auth.module';
import { BackfillModule } from './backfill/backfill.module';
import { BeneficiariesModule } from './beneficiary-management/beneficiaries.module';

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
    BeneficiariesModule,
    AnalyticsModule,
    ApprovalsModule,
    BackfillModule,
  ],
})
export class HopecardAdminServiceModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
