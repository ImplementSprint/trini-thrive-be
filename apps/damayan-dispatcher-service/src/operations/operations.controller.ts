import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard, PersonaGuard } from '@app/common';
import { OperationsService } from './operations.service';

@Controller('damayan/dispatcher')
@UseGuards(new JwtGuard(), new PersonaGuard('dispatcher', 'damayan'))
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  // ─── Overview (aggregated dashboard) ─────────────────────────────────────

  @Get('overview')
  getOverview(
    @Query('search') search?: string,
    @Query('disasterId') disasterId?: string,
  ) {
    return this.operationsService.getOverview(search, disasterId);
  }

  // ─── Dispatcher Profile ───────────────────────────────────────────────────

  @Get('profile')
  getProfile(@Request() req: any) {
    return this.operationsService.getDispatcherProfile(req.user.sub as string);
  }

  // ─── Incident Reports ─────────────────────────────────────────────────────

  @Get('incident-reports')
  findIncidentReports(
    @Query('search') search?: string,
    @Query('disasterId') disasterId?: string,
  ) {
    return this.operationsService.findIncidentReports(search, disasterId);
  }

  @Post('incident-reports')
  createIncidentReport(@Body() body: any) {
    return this.operationsService.createIncidentReport(body);
  }

  @Patch('incident-reports/:id')
  updateIncidentReport(@Param('id') id: string, @Body() body: any) {
    return this.operationsService.updateIncidentReport(id, body);
  }

  @Delete('incident-reports/:id')
  deleteIncidentReport(@Param('id') id: string) {
    return this.operationsService.deleteIncidentReport(id);
  }

  // ─── Dispatch Orders ──────────────────────────────────────────────────────

  @Get('dispatch-orders')
  findDispatchOrders(
    @Query('search') search?: string,
    @Query('operationId') operationId?: string,
    @Query('disasterId') disasterId?: string,
  ) {
    return this.operationsService.findDispatchOrders(search, operationId, disasterId);
  }

  @Post('dispatch-orders')
  createDispatchOrder(@Request() req: any, @Body() body: any) {
    return this.operationsService.createDispatchOrder(req.user.sub as string, body);
  }

  @Patch('dispatch-orders/:id')
  updateDispatchOrder(@Param('id') id: string, @Body() body: any) {
    return this.operationsService.updateDispatchOrder(id, body);
  }

  @Delete('dispatch-orders/:id')
  deleteDispatchOrder(@Param('id') id: string) {
    return this.operationsService.deleteDispatchOrder(id);
  }

  // ─── Volunteer Organizations (resources) ─────────────────────────────────

  @Get('volunteers')
  findVolunteerOrganizations(@Query('search') search?: string) {
    return this.operationsService.findVolunteerOrganizations(search);
  }

  @Get('volunteer-units')
  findVolunteerUnits(@Query('search') search?: string) {
    return this.operationsService.findVolunteerUnits(search);
  }

  @Get('volunteer-teams')
  findVolunteerTeams(@Query('search') search?: string) {
    return this.operationsService.findVolunteerTeams(search);
  }

  @Post('volunteer-dispatch')
  createVolunteerDispatch(@Body() body: {
    reportId: string;
    assignedTo: string;
    volunteerName?: string;
    priority?: string;
    instructions?: string;
    disasterId?: string;
  }) {
    return this.operationsService.createVolunteerDispatch(body);
  }

  // ─── Barangay / Location Data ─────────────────────────────────────────────

  @Get('barangay-data')
  getBarangayData(@Query('province') province?: string) {
    return this.operationsService.getBarangayData(province);
  }

  // ─── Team Status ──────────────────────────────────────────────────────────

  @Get('team-status')
  getTeamStatus() {
    return this.operationsService.getTeamStatus();
  }

  @Patch('team-status/:authUserId')
  @HttpCode(HttpStatus.OK)
  setDutyStatus(
    @Param('authUserId') authUserId: string,
    @Body() body: { dutyStatus: 'on_duty' | 'off_duty' },
  ) {
    return this.operationsService.setDutyStatus(authUserId, body.dutyStatus);
  }

  // ─── Site Manager Account Status ──────────────────────────────────────────

  @Get('site-managers/account-status')
  getSiteManagerAccountStatuses() {
    return this.operationsService.getSiteManagerAccountStatuses();
  }

  // ─── Broadcast ────────────────────────────────────────────────────────────

  @Post('broadcast')
  @HttpCode(HttpStatus.OK)
  broadcast(
    @Request() req: any,
    @Body() body: {
      message: string;
      title?: string;
      severity?: 'info' | 'warning' | 'critical';
      type?: string;
      areas?: string[];
      disasterId?: string;
    },
  ) {
    return this.operationsService.broadcast(req.user.sub as string, body);
  }
}
