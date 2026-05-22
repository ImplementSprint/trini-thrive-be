import { Controller, Get, Query } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('hopecard/donor/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google/url')
  getGoogleAuthUrl() {
    return this.authService.googleGetAuthUrl();
  }

  @Get('google/callback')
  googleCallback(@Query('code') code: string) {
    return this.authService.googleCallback(code);
  }
}
