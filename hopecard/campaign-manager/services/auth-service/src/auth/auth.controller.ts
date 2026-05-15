import { Controller, Get, Param, Query } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('manager/:authUserId')
  async getManagerProfile(@Param('authUserId') authUserId: string) {
    return this.authService.getManagerProfile(authUserId);
  }

  @Get('beneficiaries')
  async getBeneficiaryProfiles(@Query('status') status: string) {
    return this.authService.getBeneficiaryProfiles(status);
  }
}
