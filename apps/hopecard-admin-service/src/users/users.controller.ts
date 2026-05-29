import { Controller, Get, Patch, Param, Body, Query, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { RequirePersona } from '@app/common';

@RequirePersona('admin', 'hopecard')
@Controller('hopecard/admin/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /hopecard/admin/users
   * Fetch all approved/active users with optional role filtering
   */
  @Get()
  async getAllUsers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('role') role?: string,
  ) {
    const pageNum = Math.max(1, Number.parseInt(page) || 1);
    const limitNum = Math.min(100, Number.parseInt(limit) || 10);

    const result = await this.usersService.getAllUsers(pageNum, limitNum, role);

    return {
      success: true,
      ...result,
    };
  }

  /**
   * PATCH /hopecard/admin/users/:id/status
   * Update user account status (suspend, ban, reactivate)
   */
  @Patch(':id/status')
  async updateUserStatus(
    @Param('id') userId: string,
    @Body()
    body: {
      status: 'active' | 'suspended' | 'banned';
      reason: string;
      role: string;
    },
    @Request() req: any,
  ) {
    if (!body.status || !body.reason || !body.role) {
      return {
        success: false,
        message: 'Missing required fields: status, reason, role',
      };
    }

    if (!['active', 'suspended', 'banned'].includes(body.status)) {
      return { success: false, message: 'Invalid status value' };
    }

    // Extract admin ID from request (from @RequirePersona decorator context)
    // JWT payload contains 'sub', not 'id'
    const adminId = req.user?.sub || 'unknown';

    const result = await this.usersService.updateUserStatus(
      userId,
      body.status,
      body.reason,
      body.role,
      adminId,
    );

    return result;
  }
}
