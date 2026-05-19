import { Controller, Get } from '@nestjs/common';
import { RequirePersona } from '@app/common';
import { HealthService } from './health.service';

@RequirePersona('beneficiary')
@Controller('beneficiary/health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth() {
    return this.healthService.getHealth();
  }
}
