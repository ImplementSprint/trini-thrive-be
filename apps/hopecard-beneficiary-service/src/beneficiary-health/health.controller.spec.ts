jest.mock('jose', () => ({ jwtVerify: jest.fn(), SignJWT: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  const mockService = {
    getHealth: jest.fn().mockResolvedValue({
      status: 'ok',
      service: 'beneficiary-health-service',
      timestamp: new Date().toISOString(),
      checks: { database: true },
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: mockService }],
    }).compile();
    controller = module.get<HealthController>(HealthController);
  });

  it('getHealth delegates to HealthService', async () => {
    const result = await controller.getHealth();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('beneficiary-health-service');
    expect(mockService.getHealth).toHaveBeenCalled();
  });
});
