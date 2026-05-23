import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '@app/supabase';
import { AuthModule } from './auth/auth.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { MissionsModule } from './missions/missions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { QrScanModule } from './qr-scan/qr-scan.module';
import { ShiftsModule } from './shifts/shifts.module';
import { TasksModule } from './tasks/tasks.module';
import { VolunteerRolesModule } from './volunteer-roles/volunteer-roles.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    AuthModule,
    CampaignsModule,
    MissionsModule,
    NotificationsModule,
    QrScanModule,
    ShiftsModule,
    TasksModule,
    VolunteerRolesModule,
  ],
})
export class SitemanagerModule {}
