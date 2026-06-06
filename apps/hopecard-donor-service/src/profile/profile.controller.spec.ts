jest.mock('jose', () => ({ jwtVerify: jest.fn(), SignJWT: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

const mockService = {
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  getImpact: jest.fn(),
};

describe('ProfileController', () => {
  let controller: ProfileController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [{ provide: ProfileService, useValue: mockService }],
    }).compile();
    controller = module.get<ProfileController>(ProfileController);
  });

  it('getProfile delegates authUserId and email', async () => {
    const profile = { id: 'p1', first_name: 'Test' };
    mockService.getProfile.mockResolvedValue({ profile });
    const result = await controller.getProfile('user-uuid', 'test@test.com');
    expect(mockService.getProfile).toHaveBeenCalledWith('user-uuid', 'test@test.com');
    expect(result).toEqual({ profile });
  });

  it('updateProfile splits authUserId from updates', async () => {
    mockService.updateProfile.mockResolvedValue({ success: true });
    const result = await controller.updateProfile({ authUserId: 'user-uuid', first_name: 'New' });
    expect(mockService.updateProfile).toHaveBeenCalledWith('user-uuid', { first_name: 'New' });
    expect(result).toEqual({ success: true });
  });

  it('getImpact delegates authUserId', async () => {
    const impact = { stats: {}, donation_history: [] };
    mockService.getImpact.mockResolvedValue(impact);
    const result = await controller.getImpact('user-uuid');
    expect(mockService.getImpact).toHaveBeenCalledWith('user-uuid');
    expect(result).toEqual(impact);
  });
});
