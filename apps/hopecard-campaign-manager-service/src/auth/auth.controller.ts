import { Body, Controller, Get, HttpCode, Param, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { RequirePersona } from '@app/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';

@Controller('hopecard/cm/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'secRegistration', maxCount: 1 },
    { name: 'orgCertificate', maxCount: 1 },
  ], { limits: { fileSize: 5 * 1024 * 1024 } }))
  register(
    @UploadedFiles() files: { secRegistration?: Express.Multer.File[]; orgCertificate?: Express.Multer.File[] },
    @Body() body: RegisterDto,
  ) {
    return this.authService.register(body, files ?? {});
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @RequirePersona('cm', 'hopecard')
  @Get('manager/:authUserId')
  async getManagerProfile(@Param('authUserId') authUserId: string) {
    return this.authService.getManagerProfile(authUserId);
  }

  @RequirePersona('cm', 'hopecard')
  @Get('beneficiaries')
  async getBeneficiaryProfiles(@Query('status') status: string) {
    return this.authService.getBeneficiaryProfiles(status);
  }
}
