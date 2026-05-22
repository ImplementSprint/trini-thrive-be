import { Module } from '@nestjs/common';
import { SupabaseModule } from '@app/supabase';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [SupabaseModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
