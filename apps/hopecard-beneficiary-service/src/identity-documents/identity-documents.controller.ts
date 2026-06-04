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

interface AuthenticatedRequest {
  user: { sub: string };
}

@RequirePersona('beneficiary', 'hopecard')
@Controller('api/v1/hopecard/beneficiary/identity-documents')
export class IdentityDocumentsController {
  constructor(
    private readonly identityDocumentsService: IdentityDocumentsService,
  ) {}

  @Get()
  getDocuments(@Req() req: AuthenticatedRequest) {
    return this.identityDocumentsService.getDocuments(req.user.sub);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @Req() req: AuthenticatedRequest,
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
  deleteDocument(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.identityDocumentsService.deleteDocument(req.user.sub, id);
  }

  @Post('signed-url')
  getSignedUrl(
    @Req() req: AuthenticatedRequest,
    @Body('documentKey') documentKey: string,
  ) {
    return this.identityDocumentsService.getSignedUrl(
      req.user.sub,
      documentKey,
    );
  }
}
