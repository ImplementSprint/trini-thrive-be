import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePersona } from '@app/common';
import { ShiftsService } from './shifts.service';

@RequirePersona('site-manager', 'bayanihub')
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get('pending')
  getPendingShifts() {
    return this.shiftsService.getPendingShifts();
  }

  @Get('history')
  getShiftHistory(
    @Query('status') status?: string,
    @Query('volunteer_name') volunteerName?: string,
    @Query('limit') limit?: string,
  ) {
    const payload: { status?: string; volunteerName?: string; limit?: number } = { limit: limit ? parseInt(limit, 10) : 100 };
    if (status !== undefined) payload.status = status;
    if (volunteerName !== undefined) payload.volunteerName = volunteerName;
    return this.shiftsService.getShiftHistory(payload);
  }

  @Post(':id/approve')
  approveShift(@Param('id') id: string) {
    return this.shiftsService.approveShift(id);
  }

  @Post(':id/deny')
  denyShift(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.shiftsService.denyShift(id, body?.reason);
  }

  @Patch(':id')
  editShift(
    @Param('id') id: string,
    @Body() body: { status?: string; total_hours?: number; flag_reason?: string | null; notes?: string },
  ) {
    return this.shiftsService.editShift(id, body);
  }
}
