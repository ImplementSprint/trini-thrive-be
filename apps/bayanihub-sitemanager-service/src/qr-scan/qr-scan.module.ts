import { Module } from '@nestjs/common';
import { QrScanController } from './qr-scan.controller';
import { QrScanService } from './qr-scan.service';

@Module({ controllers: [QrScanController], providers: [QrScanService] })
export class QrScanModule {}
