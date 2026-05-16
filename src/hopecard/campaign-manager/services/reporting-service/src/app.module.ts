import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ReportingModule } from './reporting/reporting.module';

@Module({
  imports: [ReportingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
