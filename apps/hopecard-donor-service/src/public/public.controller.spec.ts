jest.mock('jose', () => ({ jwtVerify: jest.fn(), SignJWT: jest.fn() }));
jest.mock('@app/common/supabase-client', () => ({ supabase: { from: jest.fn() } }));

import { Test, TestingModule } from '@nestjs/testing';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { ApiKeyGuard } from './api-key.guard';

const mockService = {
  getCampaigns: jest.fn(),
  getCampaign: jest.fn(),
};

describe('PublicController', () => {
  let controller: PublicController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicController],
      providers: [{ provide: PublicService, useValue: mockService }],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get<PublicController>(PublicController);
  });

  it('getCampaigns delegates category and search', async () => {
    mockService.getCampaigns.mockResolvedValue({ campaigns: [] });
    const result = await controller.getCampaigns('health', 'flood');
    expect(mockService.getCampaigns).toHaveBeenCalledWith('health', 'flood');
    expect(result).toEqual({ campaigns: [] });
  });

  it('getCampaign delegates id', async () => {
    mockService.getCampaign.mockResolvedValue({ campaign: { id: 'c1' } });
    const result = await controller.getCampaign('c1');
    expect(mockService.getCampaign).toHaveBeenCalledWith('c1');
    expect(result).toEqual({ campaign: { id: 'c1' } });
  });
});
