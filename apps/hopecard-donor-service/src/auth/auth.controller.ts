import { Body, Controller, Get, HttpCode, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import type { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { RequirePersona } from '@app/common';
import type { JwtPayload } from '@app/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('api/v1/hopecard/donor/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('upload-id')
  @RequirePersona('donor', 'hopecard')
  @UseInterceptors(FileInterceptor('file'))
  uploadId(
    @Req() req: Request & { user: JwtPayload },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.authService.uploadId(file, req.user.sub);
  }

  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('verify-otp')
  @HttpCode(200)
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.email, dto.otp);
  }

  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.reset_token, dto.new_password);
  }

  @Get('google/url')
  getGoogleAuthUrl() {
    return this.authService.googleGetAuthUrl();
  }

  @Get('google/callback')
  googleCallback(@Query('code') code: string) {
    return this.authService.googleCallback(code);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.cookie('persona', '', { maxAge: 0, path: '/', httpOnly: false, sameSite: 'lax' });
    return { success: true, message: 'Logged out successfully' };
  }
}
