import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard, PersonaGuard } from '@app/common';
import { OperationsService } from './operations.service';

@Controller('api/v1/damayan/dispatcher')
@UseGuards(new JwtGuard(), new PersonaGuard('dispatcher', 'damayan'))
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  // ─── Incident Reports ─────────────────────────────────────────────────────

  @Get('incident-reports')
  findIncidentReports(@Query('search') search?: string, @Query('disasterId') disasterId?: string) {
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
  findDispatchOrders(@Query('search') search?: string, @Query('operationId') operationId?: string) {
    return this.operationsService.findDispatchOrders(search, operationId);
  }

  @Post('dispatch-orders')
  createDispatchOrder(@Body() body: any) {
    return this.operationsService.createDispatchOrder(body);
  }

  // ─── Volunteer Organizations ──────────────────────────────────────────────

  @Get('volunteers')
  findVolunteerOrganizations(@Query('search') search?: string) {
    return this.operationsService.findVolunteerOrganizations(search);
  }

  // ─── Site Manager Account Status ──────────────────────────────────────────

  @Get('site-managers/account-status')
  getSiteManagerAccountStatuses() {
    return this.operationsService.getSiteManagerAccountStatuses();
  }
}
