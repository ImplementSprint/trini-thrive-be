import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { RequirePersona } from '@app/common';
import { TasksService } from './tasks.service';

@RequirePersona('site-manager', 'bayanihub')
@Controller('api/v1/bayanihub/site-manager/tasks')
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @Get('role/:roleId')
  getRoleTasks(@Param('roleId') roleId: string) {
    return this.service.getRoleTasks(roleId);
  }

  @Post('role/:roleId')
  addRoleTask(@Param('roleId') roleId: string, @Body() body: { title: string; description?: string }) {
    return this.service.addRoleTask(roleId, body.title, body.description);
  }

  @Post('assign')
  assignTasks(
    @Body() body: { application_id: string; role_id: string; campaign_id?: string; task_titles: string[]; assigned_by?: string },
  ) {
    return this.service.assignTasks(body.application_id, body.role_id, body.task_titles, body.assigned_by, body.campaign_id);
  }
}
