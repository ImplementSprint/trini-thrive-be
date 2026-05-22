import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { IdentityDocumentsController } from './identity-documents.controller';
import { IdentityDocumentsService } from './identity-documents.service';

@Module({
  imports: [MulterModule.register({ storage: memoryStorage() })],
  controllers: [IdentityDocumentsController],
  providers: [IdentityDocumentsService],
})
export class IdentityDocumentsModule {}
