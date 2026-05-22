import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('hopecard/beneficiary/health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth() {
    return this.healthService.getHealth();
  }
}
