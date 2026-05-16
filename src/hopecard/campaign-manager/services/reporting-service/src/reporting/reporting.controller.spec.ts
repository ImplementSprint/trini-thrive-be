import { Test, TestingModule } from '@nestjs/testing';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';

describe('ReportingController', () => {
  let controller: ReportingController;
  const mockService = { getDashboardData: jest.fn() };

  beforeEach(async () => {
    mockService.getDashboardData.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportingController],
      providers: [{ provide: ReportingService, useValue: mockService }],
    }).compile();
    controller = module.get<ReportingController>(ReportingController);
  });

  it('returns dashboard data from service', async () => {
    const payload = {
      metrics: { fundsRaised: 500 },
      campaigns: [],
      liveActivity: [],
    };
    mockService.getDashboardData.mockResolvedValue(payload);
    const result = await controller.getDashboardData('uid-1');
    expect(result).toEqual(payload);
    expect(mockService.getDashboardData).toHaveBeenCalledWith('uid-1');
  });

  it('propagates service errors', async () => {
    mockService.getDashboardData.mockRejectedValue(new Error('DB fail'));
    await expect(controller.getDashboardData('uid-1')).rejects.toThrow(
      'DB fail',
    );
  });
});
