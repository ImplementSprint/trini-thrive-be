import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard, PersonaGuard } from '@app/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('damayan/dispatcher/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(new JwtGuard(), new PersonaGuard('dispatcher', 'damayan'))
  getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.sub as string);
  }
}
