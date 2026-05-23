import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '@app/supabase';
import { AuthModule } from './auth/auth.module';
import { ApplicationsModule } from './applications/applications.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DocumentsModule } from './documents/documents.module';
import { DonorsModule } from './donors/donors.module';
import { NotificationsModule } from './notifications/notifications.module';
import { QrModule } from './qr/qr.module';
import { VolunteersModule } from './volunteers/volunteers.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),
    SupabaseModule,
    AuthModule,
    ApplicationsModule,
    CampaignsModule,
    DashboardModule,
    DocumentsModule,
    DonorsModule,
    NotificationsModule,
    QrModule,
    VolunteersModule,
  ],
})
export class AdminModule {}
