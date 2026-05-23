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
  UseGuards,
} from '@nestjs/common';
import { RequirePersona } from '@app/common';
import { OperationsService } from './operations.service';
import { CreateItemDto, UpdateItemDto, AdjustQuantityDto } from './dto/inventory.dto';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organization.dto';
import { CreateDisasterEventDto, UpdateDisasterEventDto } from './dto/disaster-event.dto';
import { CreateDispatchOrderDto, UpdateDispatchOrderDto } from './dto/dispatch-order.dto';
import { CreateReliefOperationDto, UpdateReliefOperationDto } from './dto/relief-operation.dto';
import { CreateIncidentReportDto, UpdateIncidentReportDto } from './dto/incident-report.dto';
import { CreateDistributionDto, UpdateDistributionDto } from './dto/distribution.dto';
import { CreateCitizenDto, UpdateCitizenDto, CreateFamilyDto, UpdateFamilyDto } from './dto/registration.dto';
import {
  CreateDisasterCoverUploadDto,
  CreateIncidentAttachmentUploadDto,
  CreateObjectViewUrlDto,
  CreateWarningBroadcastDto,
} from './dto/uploads.dto';

@Controller('api/v1/damayan/admin')
@RequirePersona('admin', 'damayan')
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  // ─── Dashboard ────────────────────────────────────────────────────────────

  @Get('dashboard')
  getDashboard() {
    return this.operationsService.getDashboard();
  }

  @Get('dashboard/health')
  getSystemHealth() {
    return this.operationsService.getSystemHealth();
  }

  // ─── Approvals ────────────────────────────────────────────────────────────

  @Get('approvals')
  findPendingApprovals() {
    return this.operationsService.findPendingApprovals();
  }

  @Patch('approvals/:id/approve')
  @HttpCode(HttpStatus.OK)
  approvePendingUser(@Param('id') id: string) {
    return this.operationsService.approvePendingUser(id);
  }

  @Patch('approvals/:id/reject')
  @HttpCode(HttpStatus.OK)
  rejectPendingUser(@Param('id') id: string, @Body('reason') reason: string) {
    return this.operationsService.rejectPendingUser(id, reason);
  }

  // ─── Inventory ───────────────────────────────────────────────────────────

  @Get('inventory')
  findInventory(@Query('search') search?: string) {
    return this.operationsService.findInventory(search);
  }

  @Get('inventory/stats')
  getInventoryStats() {
    return this.operationsService.getInventoryStats();
  }

  @Post('inventory')
  createInventoryItem(@Body() dto: CreateItemDto) {
    return this.operationsService.createInventoryItem(dto);
  }

  @Patch('inventory/:id')
  updateInventoryItem(@Param('id') id: string, @Body() dto: UpdateItemDto) {
    return this.operationsService.updateInventoryItem(id, dto);
  }

  @Patch('inventory/:id/adjust')
  @HttpCode(HttpStatus.OK)
  adjustInventoryItem(@Param('id') id: string, @Body() dto: AdjustQuantityDto) {
    return this.operationsService.adjustInventoryItem(id, dto);
  }

  // ─── Capacity ────────────────────────────────────────────────────────────

  @Get('capacity')
  findCapacity() {
    return this.operationsService.findCapacity();
  }

  @Get('capacity/stats')
  getCapacityStats() {
    return this.operationsService.getCapacityStats();
  }

  // ─── Organizations ────────────────────────────────────────────────────────

  @Get('organizations')
  findOrganizations(@Query('search') search?: string) {
    return this.operationsService.findOrganizations(search);
  }

  @Get('organizations/stats')
  getOrganizationStats() {
    return this.operationsService.getOrganizationStats();
  }

  @Post('organizations')
  createOrganization(@Body() dto: CreateOrganizationDto) {
    return this.operationsService.createOrganization(dto);
  }

  @Patch('organizations/:id')
  updateOrganization(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.operationsService.updateOrganization(id, dto);
  }

  @Delete('organizations/:id')
  deleteOrganization(@Param('id') id: string) {
    return this.operationsService.deleteOrganization(id);
  }

  // ─── Disaster Events ──────────────────────────────────────────────────────

  @Get('disaster-events')
  findDisasterEvents(@Query('search') search?: string) {
    return this.operationsService.findDisasterEvents(search);
  }

  @Get('disaster-events/stats')
  getDisasterEventStats() {
    return this.operationsService.getDisasterEventStats();
  }

  @Post('disaster-events')
  createDisasterEvent(@Body() dto: CreateDisasterEventDto) {
    return this.operationsService.createDisasterEvent(dto);
  }

  @Patch('disaster-events/:id')
  updateDisasterEvent(@Param('id') id: string, @Body() dto: UpdateDisasterEventDto) {
    return this.operationsService.updateDisasterEvent(id, dto);
  }

  @Delete('disaster-events/:id')
  deleteDisasterEvent(@Param('id') id: string) {
    return this.operationsService.deleteDisasterEvent(id);
  }

  // ─── Dispatch Orders ──────────────────────────────────────────────────────

  @Get('dispatch-orders')
  findDispatchOrders(@Query('search') search?: string, @Query('status') status?: string) {
    return this.operationsService.findDispatchOrders(search, status);
  }

  @Get('dispatch-orders/stats')
  getDispatchOrderStats() {
    return this.operationsService.getDispatchOrderStats();
  }

  @Post('dispatch-orders')
  createDispatchOrder(@Body() dto: CreateDispatchOrderDto) {
    return this.operationsService.createDispatchOrder(dto);
  }

  @Patch('dispatch-orders/:id')
  updateDispatchOrder(@Param('id') id: string, @Body() dto: UpdateDispatchOrderDto) {
    return this.operationsService.updateDispatchOrder(id, dto);
  }

  @Delete('dispatch-orders/:id')
  deleteDispatchOrder(@Param('id') id: string) {
    return this.operationsService.deleteDispatchOrder(id);
  }

  // ─── Relief Operations ────────────────────────────────────────────────────

  @Get('relief-operations')
  findReliefOperations(@Query('search') search?: string, @Query('status') status?: string) {
    return this.operationsService.findReliefOperations(search, status);
  }

  @Get('relief-operations/stats')
  getReliefOperationStats() {
    return this.operationsService.getReliefOperationStats();
  }

  @Post('relief-operations')
  createReliefOperation(@Body() dto: CreateReliefOperationDto) {
    return this.operationsService.createReliefOperation(dto);
  }

  @Patch('relief-operations/:id')
  updateReliefOperation(@Param('id') id: string, @Body() dto: UpdateReliefOperationDto) {
    return this.operationsService.updateReliefOperation(id, dto);
  }

  @Delete('relief-operations/:id')
  deleteReliefOperation(@Param('id') id: string) {
    return this.operationsService.deleteReliefOperation(id);
  }

  // ─── Incident Reports ─────────────────────────────────────────────────────

  @Get('incident-reports')
  findIncidentReports(@Query('search') search?: string, @Query('status') status?: string) {
    return this.operationsService.findIncidentReports(search, status);
  }

  @Get('incident-reports/stats')
  getIncidentReportStats() {
    return this.operationsService.getIncidentReportStats();
  }

  @Post('incident-reports')
  createIncidentReport(@Body() dto: CreateIncidentReportDto) {
    return this.operationsService.createIncidentReport(dto);
  }

  @Patch('incident-reports/:id')
  updateIncidentReport(@Param('id') id: string, @Body() dto: UpdateIncidentReportDto) {
    return this.operationsService.updateIncidentReport(id, dto);
  }

  @Delete('incident-reports/:id')
  deleteIncidentReport(@Param('id') id: string) {
    return this.operationsService.deleteIncidentReport(id);
  }

  // ─── Distributions ────────────────────────────────────────────────────────

  @Get('distributions')
  findDistributions(@Query('operationId') operationId?: string) {
    return this.operationsService.findDistributions(operationId);
  }

  @Get('distributions/stats')
  getDistributionStats() {
    return this.operationsService.getDistributionStats();
  }

  @Post('distributions')
  createDistribution(@Body() dto: CreateDistributionDto) {
    return this.operationsService.createDistribution(dto);
  }

  @Patch('distributions/:id')
  updateDistribution(@Param('id') id: string, @Body() dto: UpdateDistributionDto) {
    return this.operationsService.updateDistribution(id, dto);
  }

  @Delete('distributions/:id')
  deleteDistribution(@Param('id') id: string) {
    return this.operationsService.deleteDistribution(id);
  }

  // ─── Citizens ─────────────────────────────────────────────────────────────

  @Get('citizens')
  findCitizens(@Query('search') search?: string) {
    return this.operationsService.findCitizens(search);
  }

  @Post('citizens')
  createCitizen(@Body() dto: CreateCitizenDto) {
    return this.operationsService.createCitizen(dto);
  }

  @Patch('citizens/:id')
  updateCitizen(@Param('id') id: string, @Body() dto: UpdateCitizenDto) {
    return this.operationsService.updateCitizen(id, dto);
  }

  @Delete('citizens/:id')
  deleteCitizen(@Param('id') id: string) {
    return this.operationsService.deleteCitizen(id);
  }

  // ─── Families ─────────────────────────────────────────────────────────────

  @Get('families')
  findFamilies(@Query('citizenId') citizenId?: string) {
    return this.operationsService.findFamilies(citizenId);
  }

  @Post('families')
  createFamily(@Body() dto: CreateFamilyDto) {
    return this.operationsService.createFamily(dto);
  }

  @Patch('families/:id')
  updateFamily(@Param('id') id: string, @Body() dto: UpdateFamilyDto) {
    return this.operationsService.updateFamily(id, dto);
  }

  @Delete('families/:id')
  deleteFamily(@Param('id') id: string) {
    return this.operationsService.deleteFamily(id);
  }

  // ─── Registrations ────────────────────────────────────────────────────────

  @Get('registrations/stats')
  getRegistrationStats() {
    return this.operationsService.getRegistrationStats();
  }

  // ─── Check-ins ────────────────────────────────────────────────────────────

  @Get('check-ins')
  findCheckIns(@Query('disasterId') disasterId?: string) {
    return this.operationsService.findCheckIns(disasterId);
  }

  @Get('check-ins/stats')
  getCheckInStats() {
    return this.operationsService.getCheckInStats();
  }

  @Get('check-ins/recent')
  getRecentCheckIns() {
    return this.operationsService.getRecentCheckIns();
  }

  // ─── Uploads ──────────────────────────────────────────────────────────────

  @Post('uploads/disaster-cover')
  @HttpCode(HttpStatus.OK)
  createDisasterCoverUploadUrl(@Body() dto: CreateDisasterCoverUploadDto) {
    return this.operationsService.createDisasterCoverUploadUrl(dto);
  }

  @Post('uploads/incident-attachment')
  @HttpCode(HttpStatus.OK)
  createIncidentAttachmentUploadUrl(@Body() dto: CreateIncidentAttachmentUploadDto) {
    return this.operationsService.createIncidentAttachmentUploadUrl(dto);
  }

  @Post('uploads/view-url')
  @HttpCode(HttpStatus.OK)
  createObjectViewUrl(@Body() dto: CreateObjectViewUrlDto) {
    return this.operationsService.createObjectViewUrl(dto);
  }

  // ─── Warnings ─────────────────────────────────────────────────────────────

  @Post('warnings/broadcast')
  @HttpCode(HttpStatus.OK)
  broadcastWarning(@Body() dto: CreateWarningBroadcastDto) {
    return this.operationsService.broadcastWarning(dto);
  }
}
