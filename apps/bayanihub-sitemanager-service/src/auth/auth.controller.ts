import { Controller, Post, Body, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RequirePersona } from '@app/common';
import { JwtPayload } from '@app/common';

@Controller('api/v1/bayanihub/site-manager/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body);
  }

  @Get('profile')
  @RequirePersona('site-manager', 'bayanihub')
  async getProfile(@Req() req: Request) {
    const user = (req as Request & { user: JwtPayload }).user;
    return { id: user.sub, email: user.email, persona: user.persona, system: user.system };
  }

  @Post('send-otp')
  async sendOtp(@Body() body: { email: string }) {
    return this.authService.sendOtp(body.email);
  }

  @Post('verify-otp')
  async verifyOtp(@Body() body: { email: string; otp: string }) {
    return this.authService.verifyOtp(body.email, body.otp);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { email: string; otp: string; password: string }) {
    return this.authService.resetPassword(body.email, body.otp, body.password);
  }
}
