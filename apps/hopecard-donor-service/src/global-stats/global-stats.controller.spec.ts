jest.mock('jose', () => ({ jwtVerify: jest.fn(), SignJWT: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { GlobalStatsController } from './global-stats.controller';
import { GlobalStatsService } from './global-stats.service';

describe('GlobalStatsController', () => {
  let controller: GlobalStatsController;
  const mockService = { getStats: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GlobalStatsController],
      providers: [{ provide: GlobalStatsService, useValue: mockService }],
    }).compile();
    controller = module.get<GlobalStatsController>(GlobalStatsController);
  });

  it('delegates getStats to service', async () => {
    const stats = { livesImpacted: 7, fundsRaised: 1400, globalPartners: 5 };
    mockService.getStats.mockResolvedValue(stats);
    const result = await controller.getStats();
    expect(result).toEqual(stats);
    expect(mockService.getStats).toHaveBeenCalled();
  });
});
