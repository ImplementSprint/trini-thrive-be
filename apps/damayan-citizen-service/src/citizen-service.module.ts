import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '@app/supabase';
import { GatewayModule, HealthModule } from '@app/common';
import { AuthModule } from './auth/auth.module';
import { OperationsModule } from './operations/operations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    GatewayModule,
    HealthModule,
    AuthModule,
    OperationsModule,
  ],
})
export class DamayanCitizenServiceModule {}
