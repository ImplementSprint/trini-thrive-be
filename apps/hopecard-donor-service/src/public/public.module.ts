import { Module } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  controllers: [PublicController],
  providers: [ApiKeyGuard, PublicService],
})
export class PublicModule {}
