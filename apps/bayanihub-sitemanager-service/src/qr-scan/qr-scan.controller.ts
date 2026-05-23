import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { RequirePersona } from '@app/common';
import { QrScanService } from './qr-scan.service';

@RequirePersona('site-manager', 'bayanihub')
@Controller('api/v1/bayanihub/site-manager/qr-scan')
export class QrScanController {
  constructor(private readonly qrScanService: QrScanService) {}

  @Get(':id')
  verify(@Param('id') id: string) {
    return this.qrScanService.verifyQr(id);
  }

  @Post('reconcile')
  reconcile(@Body() body: { donation_id: string; item_name: string; quantity: number; unit: string; donation_type: string }) {
    return this.qrScanService.reconcileDonation(body);
  }

  @Post('check-in')
  checkIn(@Body() body: { application_id: string }) {
    return this.qrScanService.checkInVolunteer(body.application_id);
  }
}
