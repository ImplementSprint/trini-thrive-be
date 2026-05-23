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
import { HealthModule as BeneficiaryHealthModule } from './beneficiary-health/health.module';
import { BankAccountsModule } from './bank-accounts/bank-accounts.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { IdentityDocumentsModule } from './identity-documents/identity-documents.module';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';
import { BeneficiaryNotificationsModule } from './notifications/notifications.module';

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
    BeneficiaryHealthModule,
    BankAccountsModule,
    CampaignsModule,
    IdentityDocumentsModule,
    WithdrawalsModule,
    BeneficiaryNotificationsModule,
  ],
})
export class HopecardBeneficiaryServiceModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
