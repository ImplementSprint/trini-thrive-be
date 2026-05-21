import { Controller, Post, Body, Req, Get, Res, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthService } from './auth.service';

@Controller('hopecard/donor/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Post('signup')
  signup(@Body() body: any, @Req() req: any) {
    return this.authService.signup({ ...body, origin: req.headers.origin });
  }

  @Post('send-otp')
  sendOtp(@Body() body: { email: string }) {
    return this.authService.sendOtp(body.email);
  }

  @Post('verify-otp')
  verifyOtp(@Body() body: { email: string; token: string; type?: string }) {
    return this.authService.verifyOtp(body.email, body.token, body.type);
  }

  @Post('generate-otp')
  generateOtp(@Body() body: { email: string }) {
    return this.authService.generateOtp(body.email);
  }

  @Post('verify-numeric-otp')
  verifyNumericOtp(@Body() body: { email: string; code: string }) {
    return this.authService.verifyNumericOtp(body.email, body.code);
  }

  @Post('check-email')
  checkEmail(@Body() body: { email: string }) {
    return this.authService.checkEmail(body.email);
  }

  @Post('reset-password-with-otp')
  resetPasswordWithOtp(@Body() body: { email: string; password: string; sessionToken: string }) {
    return this.authService.resetPasswordWithOtp(body.email, body.password, body.sessionToken);
  }

  @Post('update-password')
  updatePassword(@Body() body: { password: string; accessToken: string }) {
    return this.authService.updatePassword(body.password, body.accessToken);
  }

  @Post('upload-id')
  @UseInterceptors(FileInterceptor('file'))
  uploadId(@UploadedFile() file: Express.Multer.File, @Body('userId') userId: string) {
    return this.authService.uploadId(file, userId);
  }

  @Get('google/url')
  async googleUrl(@Req() req: any) {
    const callbackUrl = `${req.protocol}://${req.get('host')}/hopecard/donor/auth/google/callback`;
    return this.authService.googleGetAuthUrl(callbackUrl);
  }

  @Get('google/callback')
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const callbackUrl = `${req.protocol}://${req.get('host')}/hopecard/donor/auth/google/callback`;
    const { redirectUrl } = await this.authService.googleCallback(req.query.code as string, callbackUrl);
    return res.redirect(302, redirectUrl);
  }
}
