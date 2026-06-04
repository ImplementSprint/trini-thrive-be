import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ActivityLogger } from '@app/common/activity-logger';

@Module({
  controllers: [UsersController],
  providers: [UsersService, ActivityLogger],
})
export class UsersModule {}
