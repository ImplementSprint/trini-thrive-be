import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { RequirePersona, JwtPayload } from '@app/common';
import { QrService } from './qr.service';
import { GenerateQrDto } from './dto/generate-qr.dto';

@RequirePersona('admin', 'bayanihub')
@Controller('api/v1/bayanihub/admin/qr')
export class QrController {
  constructor(private readonly qrService: QrService) {}

  @Post('generate')
  generate(@Body() dto: GenerateQrDto, @Req() req: Request) {
    const user = (req as Request & { user: JwtPayload }).user;
    return this.qrService.generate(dto, user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.qrService.findOne(id); }

  @Get('application/:applicationId')
  findByApplication(@Param('applicationId') id: string) { return this.qrService.findByApplication(id); }

  @Get('donation/:donationId')
  findByDonation(@Param('donationId') id: string) { return this.qrService.findByDonation(id); }
}
