import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RequirePersona } from '@app/common';
import { IdentityDocumentsService } from './identity-documents.service';

@RequirePersona('beneficiary')
@Controller('hopecard/beneficiary/identity-documents')
export class IdentityDocumentsController {
  constructor(
    private readonly identityDocumentsService: IdentityDocumentsService,
  ) {}

  @Get()
  getDocuments(@Req() req: any) {
    return this.identityDocumentsService.getDocuments(req.user.sub);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('label') label?: string,
  ) {
    return this.identityDocumentsService.uploadDocument(
      req.user.sub,
      file,
      label,
    );
  }

  @Delete(':id')
  deleteDocument(@Req() req: any, @Param('id') id: string) {
    return this.identityDocumentsService.deleteDocument(req.user.sub, id);
  }

  @Post('signed-url')
  getSignedUrl(@Req() req: any, @Body('documentKey') documentKey: string) {
    return this.identityDocumentsService.getSignedUrl(
      req.user.sub,
      documentKey,
    );
  }
}
