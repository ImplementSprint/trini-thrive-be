import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ActivityService, Activity } from './activity.service';
import { Protected } from '@shared/protected.decorator';
import { supabase } from '@shared/supabaseClient';

@Controller('activity')
export class ActivityController {
  constructor(private activityService: ActivityService) {}

  @EventPattern('log_activity')
  async handleLogActivityEvent(@Payload() data: Activity) {
    console.log(`[EVENT] Received log_activity event: ${data.action}`);
    return this.activityService.logActivity(data);
  }

  @Post('log')
  @Protected()
  @HttpCode(HttpStatus.CREATED)
  async logActivity(@Body() activity: Activity, @Request() req: any) {
    const user = req.user;
    const activityPayload: Activity = {
      admin_id: user.id,
      admin_email: user.email,
      action: activity.action,
      description: activity.description,
      resource_type: activity.resource_type,
      resource_id: activity.resource_id,
      changes: activity.changes,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('user-agent'),
    };

    return this.activityService.logActivity(activityPayload);
  }

  @Get()
  @Protected()
  async getActivityLog(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('admin_id') adminId?: string,
    @Query('action') action?: string,
    @Query('resource_type') resourceType?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    try {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

      return await this.activityService.getActivityLog(pageNum, limitNum, {
        admin_id: adminId,
        action: action,
        resource_type: resourceType,
        date_from: dateFrom,
        date_to: dateTo,
      });
    } catch (error) {
      console.error('❌ Error in getActivityLog:', error);
      // Return empty list on error instead of throwing 500
      return {
        data: [],
        total: 0,
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 20,
      };
    }
  }

  @Get('recent')
  @Protected()
  async getRecentActivity(@Query('hours') hours: string = '24') {
    try {
      const hoursNum = Math.min(8760, Math.max(1, parseInt(hours, 10) || 24)); // Max 1 year
      return await this.activityService.getRecentActivity(hoursNum);
    } catch (error) {
      console.error('❌ Error in getRecentActivity:', error);
      // Return empty list on error
      return {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      };
    }
  }

  @Get('by-admin/:adminId')
  @Protected()
  async getActivityByAdmin(
    @Param('adminId') adminId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    try {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      return await this.activityService.getActivityByAdmin(adminId, pageNum, limitNum);
    } catch (error) {
      console.error('❌ Error in getActivityByAdmin:', error);
      return {
        data: [],
        total: 0,
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 20,
      };
    }
  }

  @Get('by-resource/:resourceType')
  @Protected()
  async getActivityByResourceType(
    @Param('resourceType') resourceType: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    try {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      return await this.activityService.getActivityByResourceType(
        resourceType,
        pageNum,
        limitNum,
      );
    } catch (error) {
      console.error('❌ Error in getActivityByResourceType:', error);
      return {
        data: [],
        total: 0,
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 20,
      };
    }
  }

  @Get('by-action/:action')
  @Protected()
  async getActivityByAction(
    @Param('action') action: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    try {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      return await this.activityService.getActivityByAction(action, pageNum, limitNum);
    } catch (error) {
      console.error('❌ Error in getActivityByAction:', error);
      return {
        data: [],
        total: 0,
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 20,
      };
    }
  }

  @Post('cleanup')
  @Protected()
  @HttpCode(HttpStatus.OK)
  async deleteOldActivities(@Query('days') days: string = '90') {
    const daysNum = Math.min(3650, Math.max(1, parseInt(days, 10) || 90)); // Max 10 years
    return this.activityService.deleteOldActivities(daysNum);
  }
}
