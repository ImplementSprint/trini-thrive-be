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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard, PersonaGuard } from '@app/common';
import { OperationsService } from './operations.service';
import { UpsertAfterActionAssessmentDto } from './dto/after-action.dto';
import { CreateCheckInDto, ScanQrDto } from './dto/check-in.dto';

@Controller('damayan/site-manager')
@UseGuards(new JwtGuard(), new PersonaGuard('site_manager', 'damayan'))
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  // ─── Dashboard ────────────────────────────────────────────────────────────

  @Get('dashboard')
  getDashboard() {
    return this.operationsService.getDashboard();
  }

  // ─── After-Action Assessment ──────────────────────────────────────────────

  @Get('after-action-assessment/latest')
  getLatestAfterActionAssessment(@Query('disasterId') disasterId?: string) {
    return this.operationsService.getLatestAfterActionAssessment(disasterId);
  }

  @Put('after-action-assessment')
  upsertAfterActionAssessment(@Body() dto: UpsertAfterActionAssessmentDto) {
    return this.operationsService.upsertAfterActionAssessment(dto);
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

  @Get('inventory/:id')
  findInventoryItem(@Param('id') id: string) {
    return this.operationsService.findInventoryItem(id);
  }

  @Post('inventory')
  createInventoryItem(@Body() body: any) {
    return this.operationsService.createInventoryItem(body);
  }

  @Put('inventory/:id')
  updateInventoryItem(@Param('id') id: string, @Body() body: any) {
    return this.operationsService.updateInventoryItem(id, body);
  }

  @Patch('inventory/:id/adjust')
  adjustInventoryItem(@Param('id') id: string, @Body() body: { adjustment: number; reason?: string }) {
    return this.operationsService.adjustInventoryItem(id, body);
  }

  @Delete('inventory/:id')
  deleteInventoryItem(@Param('id') id: string) {
    return this.operationsService.deleteInventoryItem(id);
  }

  @Post('inventory/receive')
  @HttpCode(HttpStatus.OK)
  receiveInventory(@Body() body: { itemIds: string[]; quantities: number[]; arrivalTerminal?: string; waybillNumber?: string; condition?: string }) {
    return this.operationsService.receiveInventory(body);
  }

  @Post('inventory/batch')
  createInventoryBatch(@Body() body: { name?: string; items: Array<{ itemId: string; quantity: number }> }) {
    return this.operationsService.createInventoryBatch(body);
  }

  // ─── Capacity ────────────────────────────────────────────────────────────

  @Get('capacity')
  findCapacity(@Query('search') search?: string) {
    return this.operationsService.findCapacity(search);
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

  // ─── Disaster Events ──────────────────────────────────────────────────────

  @Get('disaster-events')
  findDisasterEvents(@Query('search') search?: string) {
    return this.operationsService.findDisasterEvents(search);
  }

  @Get('disaster-events/stats')
  getDisasterEventStats() {
    return this.operationsService.getDisasterEventStats();
  }

  // ─── Dispatch Orders ──────────────────────────────────────────────────────

  @Get('dispatch-orders')
  findDispatchOrders(@Query('search') search?: string, @Query('operationId') operationId?: string) {
    return this.operationsService.findDispatchOrders(search, operationId);
  }

  @Get('dispatch-orders/stats')
  getDispatchOrderStats() {
    return this.operationsService.getDispatchOrderStats();
  }

  @Post('dispatch-orders')
  createDispatchOrder(@Body() body: any) {
    return this.operationsService.createDispatchOrder(body);
  }

  @Put('dispatch-orders/:id')
  updateDispatchOrder(@Param('id') id: string, @Body() body: any) {
    return this.operationsService.updateDispatchOrder(id, body);
  }

  @Delete('dispatch-orders/:id')
  deleteDispatchOrder(@Param('id') id: string) {
    return this.operationsService.deleteDispatchOrder(id);
  }

  // ─── Relief Operations ────────────────────────────────────────────────────

  @Get('relief-operations')
  findReliefOperations(@Query('search') search?: string, @Query('disasterId') disasterId?: string) {
    return this.operationsService.findReliefOperations(search, disasterId);
  }

  @Get('relief-operations/stats')
  getReliefOperationStats() {
    return this.operationsService.getReliefOperationStats();
  }

  @Post('relief-operations')
  createReliefOperation(@Body() body: any) {
    return this.operationsService.createReliefOperation(body);
  }

  @Put('relief-operations/:id')
  updateReliefOperation(@Param('id') id: string, @Body() body: any) {
    return this.operationsService.updateReliefOperation(id, body);
  }

  @Delete('relief-operations/:id')
  deleteReliefOperation(@Param('id') id: string) {
    return this.operationsService.deleteReliefOperation(id);
  }

  // ─── Incident Reports ─────────────────────────────────────────────────────

  @Get('incident-reports')
  findIncidentReports(@Query('search') search?: string, @Query('disasterId') disasterId?: string) {
    return this.operationsService.findIncidentReports(search, disasterId);
  }

  @Get('incident-reports/stats')
  getIncidentReportStats() {
    return this.operationsService.getIncidentReportStats();
  }

  @Post('incident-reports')
  createIncidentReport(@Body() body: any) {
    return this.operationsService.createIncidentReport(body);
  }

  @Put('incident-reports/:id')
  updateIncidentReport(@Param('id') id: string, @Body() body: any) {
    return this.operationsService.updateIncidentReport(id, body);
  }

  @Delete('incident-reports/:id')
  deleteIncidentReport(@Param('id') id: string) {
    return this.operationsService.deleteIncidentReport(id);
  }

  // ─── Distributions ────────────────────────────────────────────────────────

  @Get('distributions')
  findDistributions(@Query('search') search?: string, @Query('operationId') operationId?: string) {
    return this.operationsService.findDistributions(search, operationId);
  }

  @Get('distributions/stats')
  getDistributionStats() {
    return this.operationsService.getDistributionStats();
  }

  @Post('distributions')
  createDistribution(@Body() body: any) {
    return this.operationsService.createDistribution(body);
  }

  @Put('distributions/:id')
  updateDistribution(@Param('id') id: string, @Body() body: any) {
    return this.operationsService.updateDistribution(id, body);
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
  createCitizen(@Body() body: any) {
    return this.operationsService.createCitizen(body);
  }

  @Put('citizens/:id')
  updateCitizen(@Param('id') id: string, @Body() body: any) {
    return this.operationsService.updateCitizen(id, body);
  }

  @Delete('citizens/:id')
  deleteCitizen(@Param('id') id: string) {
    return this.operationsService.deleteCitizen(id);
  }

  // ─── Families ─────────────────────────────────────────────────────────────

  @Get('families')
  findFamilies(@Query('search') search?: string) {
    return this.operationsService.findFamilies(search);
  }

  @Post('families')
  createFamily(@Body() body: any) {
    return this.operationsService.createFamily(body);
  }

  @Put('families/:id')
  updateFamily(@Param('id') id: string, @Body() body: any) {
    return this.operationsService.updateFamily(id, body);
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
  findCheckIns(@Query('search') search?: string) {
    return this.operationsService.findCheckIns(search);
  }

  @Get('check-ins/stats')
  getCheckInStats() {
    return this.operationsService.getCheckInStats();
  }

  @Get('check-ins/recent')
  getRecentCheckIns(@Query('limit') limit?: string) {
    return this.operationsService.getRecentCheckIns(limit ? parseInt(limit, 10) : undefined);
  }

  @Get('check-ins/:id')
  findCheckIn(@Param('id') id: string) {
    return this.operationsService.findCheckIn(id);
  }

  @Post('check-ins/manual')
  createManualCheckIn(@Body() dto: CreateCheckInDto) {
    return this.operationsService.createManualCheckIn(dto);
  }

  @Post('check-ins/scan')
  scanQr(@Body() dto: ScanQrDto) {
    return this.operationsService.scanQr(dto);
  }

  @Patch('check-ins/:id/checkout')
  checkOut(@Param('id') id: string) {
    return this.operationsService.checkOut(id);
  }

  // ─── Uploads ──────────────────────────────────────────────────────────────

  @Post('uploads/incident-attachment')
  @HttpCode(HttpStatus.OK)
  createIncidentAttachmentUploadUrl(@Body() body: any) {
    return this.operationsService.createIncidentAttachmentUploadUrl(body);
  }

  @Post('uploads/view-url')
  @HttpCode(HttpStatus.OK)
  createObjectViewUrl(@Body() body: any) {
    return this.operationsService.createObjectViewUrl(body);
  }

  // ─── Operations close & reporting ─────────────────────────────────────────

  @Post('operations/close')
  @HttpCode(HttpStatus.OK)
  closeOperations() {
    return this.operationsService.closeOperations();
  }

  @Post('reports/summary')
  @HttpCode(HttpStatus.OK)
  generateSiteSummaryReport() {
    return this.operationsService.generateSiteSummaryReport();
  }
}
