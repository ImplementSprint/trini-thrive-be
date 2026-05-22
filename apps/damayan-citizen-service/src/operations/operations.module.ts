import { Module } from '@nestjs/common';
import { SupabaseModule } from '@app/supabase';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

@Module({
  imports: [SupabaseModule],
  controllers: [OperationsController],
  providers: [OperationsService],
})
export class OperationsModule {}
