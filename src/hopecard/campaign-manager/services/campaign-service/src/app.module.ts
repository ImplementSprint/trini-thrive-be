import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; // Import this
import { CampaignsModule } from './campaigns/campaigns.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    // Add the ConfigModule here
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CampaignsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
