import { Test, TestingModule } from '@nestjs/testing';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

describe('CampaignsController', () => {
  let controller: CampaignsController;
  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CampaignsController],
      providers: [{ provide: CampaignsService, useValue: mockService }],
    }).compile();
    controller = module.get<CampaignsController>(CampaignsController);
  });

  it('create delegates to service and returns result', async () => {
    mockService.create.mockResolvedValue({ id: 'camp-1' });
    const dto = { title: 'Test', target_amount: 1000 };
    const result = await controller.create(dto);
    expect(result).toEqual({ id: 'camp-1' });
    expect(mockService.create).toHaveBeenCalledWith(dto);
  });

  it('findAll delegates to service and returns list', async () => {
    const list = [{ id: 'c1' }, { id: 'c2' }];
    mockService.findAll.mockResolvedValue(list);
    const result = await controller.findAll();
    expect(result).toEqual(list);
    expect(mockService.findAll).toHaveBeenCalled();
  });
});
