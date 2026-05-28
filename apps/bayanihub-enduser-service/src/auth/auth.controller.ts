import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RequirePersona } from '@app/common';
import { JwtPayload } from '@app/common';
import {
  CreateUserDto,
  LoginUserDto,
  ForgotPasswordDto,
  VerifyOtpDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { FileValidationPipe } from './pipes/file-validation.pipe';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseInterceptors(FileInterceptor('id_document', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async register(
    @Body() dto: CreateUserDto,
    @UploadedFile(new FileValidationPipe()) file: Express.Multer.File,
  ) {
    return this.authService.register(dto, file);
  }

  @Post('login')
  async login(@Body() dto: LoginUserDto) {
    return this.authService.login(dto);
  }

  @Get('profile')
  @RequirePersona('enduser', 'bayanihub')
  async getProfile(@Req() req: Request) {
    const user = (req as Request & { user: JwtPayload }).user;
    return this.authService.getProfile(user.sub);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
