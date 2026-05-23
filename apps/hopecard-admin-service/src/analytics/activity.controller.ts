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
import { ActivityService } from './activity.service';
import type { Activity } from './activity.service';
import { RequirePersona } from '@app/common';

@RequirePersona('admin', 'hopecard')
@Controller('hopecard/admin/activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Post('log')

  @HttpCode(HttpStatus.CREATED)
  async logActivity(@Body() activity: Activity, @Request() req: any) {
    const user = req.user;
    const activityPayload: Activity = {
      admin_id: user.id,
      admin_email: user.email,
      action: activity.action,
      description: activity.description,
      resource_type: activity.resource_type,
      ...(activity.resource_id ? { resource_id: activity.resource_id } : {}),
      ...(activity.changes ? { changes: activity.changes } : {}),
      ...(req.ip || req.connection.remoteAddress
        ? { ip_address: req.ip || req.connection.remoteAddress }
        : {}),
      ...(req.get('user-agent') ? { user_agent: req.get('user-agent') } : {}),
    };

    return this.activityService.logActivity(activityPayload);
  }

  @Get()

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
      const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));

      const filters: {
        admin_id?: string;
        action?: string;
        resource_type?: string;
        date_from?: string;
        date_to?: string;
      } = {
        ...(adminId ? { admin_id: adminId } : {}),
        ...(action ? { action } : {}),
        ...(resourceType ? { resource_type: resourceType } : {}),
        ...(dateFrom ? { date_from: dateFrom } : {}),
        ...(dateTo ? { date_to: dateTo } : {}),
      };

      return await this.activityService.getActivityLog(pageNum, limitNum, filters);
    } catch (error) {
      console.error('❌ Error in getActivityLog:', error);
      // Return empty list on error instead of throwing 500
      return {
        data: [],
        total: 0,
        page: Number.parseInt(page, 10) || 1,
        limit: Number.parseInt(limit, 10) || 20,
      };
    }
  }

  @Get('recent')

  async getRecentActivity(@Query('hours') hours: string = '24') {
    try {
      const hoursNum = Math.min(8760, Math.max(1, Number.parseInt(hours, 10) || 24)); // Max 1 year
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

  async getActivityByAdmin(
    @Param('adminId') adminId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    try {
      const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
      return await this.activityService.getActivityByAdmin(adminId, pageNum, limitNum);
    } catch (error) {
      console.error('❌ Error in getActivityByAdmin:', error);
      return {
        data: [],
        total: 0,
        page: Number.parseInt(page, 10) || 1,
        limit: Number.parseInt(limit, 10) || 20,
      };
    }
  }

  @Get('by-resource/:resourceType')

  async getActivityByResourceType(
    @Param('resourceType') resourceType: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    try {
      const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
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
        page: Number.parseInt(page, 10) || 1,
        limit: Number.parseInt(limit, 10) || 20,
      };
    }
  }

  @Get('by-action/:action')

  async getActivityByAction(
    @Param('action') action: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    try {
      const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
      return await this.activityService.getActivityByAction(action, pageNum, limitNum);
    } catch (error) {
      console.error('❌ Error in getActivityByAction:', error);
      return {
        data: [],
        total: 0,
        page: Number.parseInt(page, 10) || 1,
        limit: Number.parseInt(limit, 10) || 20,
      };
    }
  }

  @Post('cleanup')

  @HttpCode(HttpStatus.OK)
  async deleteOldActivities(@Query('days') days: string = '90') {
    const daysNum = Math.min(3650, Math.max(1, Number.parseInt(days, 10) || 90)); // Max 10 years
    return this.activityService.deleteOldActivities(daysNum);
  }
}
