import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HealthService],
    }).compile();
    service = module.get<HealthService>(HealthService);
  });

  it('returns status ok with correct service name', () => {
    const result = service.getHealth();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('beneficiary-health-service');
  });

  it('includes a timestamp string', () => {
    const result = service.getHealth();
    expect(typeof result.timestamp).toBe('string');
    expect(new Date(result.timestamp).getTime()).not.toBeNaN();
  });
});
