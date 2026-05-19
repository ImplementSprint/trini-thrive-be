import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { RequirePersona } from '@app/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @RequirePersona('cm')
  @Get('manager/:authUserId')
  async getManagerProfile(@Param('authUserId') authUserId: string) {
    return this.authService.getManagerProfile(authUserId);
  }

  @RequirePersona('cm')
  @Get('beneficiaries')
  async getBeneficiaryProfiles(@Query('status') status: string) {
    return this.authService.getBeneficiaryProfiles(status);
  }
}
