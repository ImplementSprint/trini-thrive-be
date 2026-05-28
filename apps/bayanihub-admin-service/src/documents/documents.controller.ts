import { Controller, Get, Param, Query } from '@nestjs/common';
import { RequirePersona } from '@app/common';
import { DocumentsService } from './documents.service';

@RequirePersona('admin', 'bayanihub')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get('signed-url')
  getSignedUrl(@Query('bucket') bucket: string, @Query('key') key: string) {
    return this.documentsService.getSignedUrl(bucket, key);
  }

  @Get('application/:id')
  getApplicationDocument(@Param('id') id: string) {
    return this.documentsService.getApplicationDocument(id);
  }

  @Get('profile-photo/:userId')
  getProfilePhoto(@Param('userId') userId: string) {
    return this.documentsService.getProfilePhoto(userId);
  }

  @Get('campaign-cover/:campaignId')
  getCampaignCover(@Param('campaignId') campaignId: string) {
    return this.documentsService.getCampaignCover(campaignId);
  }

  @Get('list')
  listFiles(@Query('bucket') bucket: string, @Query('folder') folder?: string) {
    return this.documentsService.listFiles(bucket, folder);
  }
}
