import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getStatus() {
    return {
      status: 'ok',
      message: 'Campaign Manager Backend API',
      timestamp: new Date().toISOString(),
    };
  }
}
