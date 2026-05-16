import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController (CM)', () => {
  let controller: AuthController;
  const mockService = {
    getManagerProfile: jest.fn(),
    getBeneficiaryProfiles: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockService }],
    }).compile();
    controller = module.get<AuthController>(AuthController);
  });

  it('getManagerProfile delegates to service', async () => {
    mockService.getManagerProfile.mockResolvedValue({ first_name: 'Jane' });
    const result = await controller.getManagerProfile('uid-1');
    expect(result).toEqual({ first_name: 'Jane' });
    expect(mockService.getManagerProfile).toHaveBeenCalledWith('uid-1');
  });

  it('getBeneficiaryProfiles with no status query', async () => {
    mockService.getBeneficiaryProfiles.mockResolvedValue([{ id: '1' }]);
    const result = await controller.getBeneficiaryProfiles(undefined);
    expect(result).toEqual([{ id: '1' }]);
    expect(mockService.getBeneficiaryProfiles).toHaveBeenCalledWith(undefined);
  });

  it('getBeneficiaryProfiles with status query', async () => {
    mockService.getBeneficiaryProfiles.mockResolvedValue([{ id: '2' }]);
    const result = await controller.getBeneficiaryProfiles('approved');
    expect(mockService.getBeneficiaryProfiles).toHaveBeenCalledWith('approved');
    expect(result).toEqual([{ id: '2' }]);
  });
});
