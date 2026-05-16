import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

import { HealthService } from './health.service';
import { HEALTH_PATTERN } from '../shared/tokens';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @MessagePattern(HEALTH_PATTERN)
  getHealth() {
    return this.healthService.getHealth();
  }
}
