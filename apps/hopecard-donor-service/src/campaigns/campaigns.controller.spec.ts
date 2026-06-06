jest.mock('jose', () => ({ jwtVerify: jest.fn(), SignJWT: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

const mockService = { getCampaigns: jest.fn() };

describe('CampaignsController', () => {
  let controller: CampaignsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CampaignsController],
      providers: [{ provide: CampaignsService, useValue: mockService }],
    }).compile();
    controller = module.get<CampaignsController>(CampaignsController);
  });

  it('getPublicCampaigns delegates to service', async () => {
    mockService.getCampaigns.mockResolvedValue({ campaigns: [] });
    const result = await controller.getPublicCampaigns('health', 'flood');
    expect(mockService.getCampaigns).toHaveBeenCalledWith('health', 'flood');
    expect(result).toEqual({ campaigns: [] });
  });

  it('getCampaigns delegates to service', async () => {
    mockService.getCampaigns.mockResolvedValue({ campaigns: [{ id: 'c1' }] });
    const result = await controller.getCampaigns(undefined, undefined);
    expect(mockService.getCampaigns).toHaveBeenCalledWith(undefined, undefined);
    expect(result).toEqual({ campaigns: [{ id: 'c1' }] });
  });
});
