import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { RequirePersona } from '@app/common';
import { JwtPayload } from '@app/common';
import { FormsService } from './forms.service';

@RequirePersona('enduser', 'bayanihub')
@Controller('api/v1/bayanihub/enduser/forms')
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @Get('campaigns')
  async getCampaigns() {
    try {
      const result = await this.formsService.getActiveCampaigns();
      return { success: true, data: result };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('campaigns/volunteer')
  async getVolunteerCampaigns() {
    try {
      const result = await this.formsService.getVolunteerCampaigns();
      return { success: true, data: result };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('volunteer')
  @UseInterceptors(FileInterceptor('resume', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async submitVolunteer(
    @Body() volunteerData: any,
    @Req() req: Request,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    try {
      const user = (req as Request & { user: JwtPayload }).user;
      const result = await this.formsService.insertVolunteerApplication(volunteerData, user.sub, file);
      return { success: true, data: result };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('donation')
  async submitDonation(@Body() donationData: any, @Req() req: Request) {
    try {
      const user = (req as Request & { user: JwtPayload }).user;
      const result = await this.formsService.insertDonation(donationData, user.sub);
      return { success: true, data: result };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('my-application')
  async getMyApplication(@Req() req: Request) {
    try {
      const user = (req as Request & { user: JwtPayload }).user;
      const result = await this.formsService.getLatestApplication(user.sub);
      return { success: true, data: result };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('my-applications')
  async getMyApplications(@Req() req: Request) {
    try {
      const user = (req as Request & { user: JwtPayload }).user;
      const result = await this.formsService.getAllApplications(user.sub);
      return { success: true, data: result };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('my-mission')
  async getMyMission(@Req() req: Request) {
    try {
      const user = (req as Request & { user: JwtPayload }).user;
      const result = await this.formsService.getMyMission(user.sub);
      return { success: true, data: result };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('my-missions')
  async getMyMissions(@Req() req: Request) {
    try {
      const user = (req as Request & { user: JwtPayload }).user;
      const result = await this.formsService.getMyMissions(user.sub);
      return { success: true, data: result };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('my-missions/:applicationId')
  async getMyMissionByApplication(@Param('applicationId') applicationId: string, @Req() req: Request) {
    try {
      const user = (req as Request & { user: JwtPayload }).user;
      const result = await this.formsService.getMyMission(user.sub, applicationId);
      return { success: true, data: result };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('my-mission/start')
  async startMyMission(@Req() req: Request) {
    try {
      const user = (req as Request & { user: JwtPayload }).user;
      const result = await this.formsService.startMyMission(user.sub);
      return { success: true, data: result };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('my-missions/:applicationId/start')
  async startMyMissionByApplication(@Param('applicationId') applicationId: string, @Req() req: Request) {
    try {
      const user = (req as Request & { user: JwtPayload }).user;
      const result = await this.formsService.startMyMission(user.sub, applicationId);
      return { success: true, data: result };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Patch('my-mission/task-status')
  async updateMyMissionTaskStatus(
    @Body() body: { status?: 'in_progress' | 'completed' },
    @Req() req: Request,
  ) {
    try {
      const user = (req as Request & { user: JwtPayload }).user;
      const result = await this.formsService.updateMyMissionTaskStatus(user.sub, body.status);
      return { success: true, data: result };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Patch('my-missions/:applicationId/task-status')
  async updateMyMissionTaskStatusByApplication(
    @Param('applicationId') applicationId: string,
    @Body() body: { status?: 'in_progress' | 'completed' },
    @Req() req: Request,
  ) {
    try {
      const user = (req as Request & { user: JwtPayload }).user;
      const result = await this.formsService.updateMyMissionTaskStatus(user.sub, body.status, applicationId);
      return { success: true, data: result };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('my-mission/clock-out')
  async requestMyMissionClockOut(@Req() req: Request) {
    try {
      const user = (req as Request & { user: JwtPayload }).user;
      const result = await this.formsService.requestMyMissionClockOut(user.sub);
      return { success: true, data: result };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('my-missions/:applicationId/clock-out')
  async requestMyMissionClockOutByApplication(@Param('applicationId') applicationId: string, @Req() req: Request) {
    try {
      const user = (req as Request & { user: JwtPayload }).user;
      const result = await this.formsService.requestMyMissionClockOut(user.sub, applicationId);
      return { success: true, data: result };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('my-mission/summary')
  async getMyMissionSummary(@Req() req: Request) {
    try {
      const user = (req as Request & { user: JwtPayload }).user;
      const result = await this.formsService.getMyMission(user.sub);
      return { success: true, data: result };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('my-missions/:applicationId/summary')
  async getMyMissionSummaryByApplication(@Param('applicationId') applicationId: string, @Req() req: Request) {
    try {
      const user = (req as Request & { user: JwtPayload }).user;
      const result = await this.formsService.getMyMission(user.sub, applicationId);
      return { success: true, data: result };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
