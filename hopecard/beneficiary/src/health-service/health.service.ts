import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getHealth() {
    return {
      status: 'ok',
      service: 'beneficiary-health-service',
      timestamp: new Date().toISOString(),
    };
  }
}
