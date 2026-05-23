import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { RequirePersona } from '@app/common';
import { OperationsService } from './operations.service';

@Controller('api/v1/damayan/citizen')
@RequirePersona('citizen', 'damayan')
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  // ─── Profile ──────────────────────────────────────────────────────────────

  @Get('profile')
  getProfile(@Request() req: any) {
    return this.operationsService.getProfile(req.user.sub as string);
  }

  @Patch('medical')
  updateMedical(@Request() req: any, @Body() body: { bloodType?: string; medicalConditions?: string }) {
    return this.operationsService.updateMedical(req.user.sub as string, body.bloodType, body.medicalConditions);
  }

  // ─── Registration ─────────────────────────────────────────────────────────

  @Post('register')
  register(@Request() req: any, @Body() body: any) {
    return this.operationsService.register(req.user.sub as string, body);
  }

  // ─── Family ───────────────────────────────────────────────────────────────

  @Get('family')
  getFamily(@Request() req: any) {
    return this.operationsService.getFamily(req.user.sub as string);
  }

  @Post('family')
  addFamily(@Request() req: any, @Body() body: any) {
    return this.operationsService.addFamily(req.user.sub as string, body);
  }

  @Put('family/:id')
  updateFamily(@Param('id') id: string, @Body() body: any) {
    return this.operationsService.updateFamily(id, body);
  }

  @Delete('family/member/:id')
  deleteFamilyMember(@Param('id') id: string) {
    return this.operationsService.deleteFamilyMember(id);
  }

  @Delete('family/:qrCodeId')
  deleteFamilyByQr(@Param('qrCodeId') qrCodeId: string) {
    return this.operationsService.deleteFamilyByQr(qrCodeId);
  }

  // ─── Animals ──────────────────────────────────────────────────────────────

  @Get('animals')
  getAnimals(@Request() req: any) {
    return this.operationsService.getAnimals(req.user.sub as string);
  }

  @Post('animal')
  addAnimal(@Request() req: any, @Body() body: any) {
    return this.operationsService.addAnimal(req.user.sub as string, body);
  }

  @Delete('animal')
  deleteAnimals(@Request() req: any) {
    return this.operationsService.deleteAnimals(req.user.sub as string);
  }

  // ─── Family Group ─────────────────────────────────────────────────────────

  @Get('family-group')
  getFamilyGroup(@Request() req: any) {
    return this.operationsService.getFamilyGroup(req.user.sub as string);
  }

  @Post('family-group')
  createFamilyGroup(@Request() req: any, @Body() body: { familyName?: string }) {
    return this.operationsService.createFamilyGroup(req.user.sub as string, body.familyName);
  }

  @Post('family-group/members')
  addFamilyGroupMember(@Request() req: any, @Body() body: { citizenQrCodeId: string; relationship?: string }) {
    return this.operationsService.addFamilyGroupMember(req.user.sub as string, body.citizenQrCodeId, body.relationship);
  }

  @Delete('family-group/members/:qrCodeId')
  removeFamilyGroupMember(@Request() req: any, @Param('qrCodeId') qrCodeId: string) {
    return this.operationsService.removeFamilyGroupMember(req.user.sub as string, qrCodeId);
  }

  @Delete('family-group')
  deleteFamilyGroup(@Request() req: any) {
    return this.operationsService.deleteFamilyGroup(req.user.sub as string);
  }

  // ─── Citizen Lookup ───────────────────────────────────────────────────────

  @Get('lookup-citizen')
  lookupCitizen(@Query('qrCode') qrCode: string) {
    return this.operationsService.lookupCitizen(qrCode);
  }

  // ─── Incident Report ──────────────────────────────────────────────────────

  @Post('incident-report')
  createIncidentReport(@Request() req: any, @Body() body: any) {
    return this.operationsService.createIncidentReport(req.user.sub as string, body);
  }
}
