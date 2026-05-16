import { Test, TestingModule } from '@nestjs/testing';
import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';

describe('ApiGatewayController', () => {
  let controller: ApiGatewayController;
  const mockService = { getHealth: jest.fn() };

  beforeEach(async () => {
    mockService.getHealth.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiGatewayController],
      providers: [{ provide: ApiGatewayService, useValue: mockService }],
    }).compile();
    controller = module.get<ApiGatewayController>(ApiGatewayController);
  });

  it('delegates getHealth to ApiGatewayService', async () => {
    const payload = { status: 'ok', service: 'beneficiary-health-service' };
    mockService.getHealth.mockResolvedValue(payload);
    const result = await controller.getHealth();
    expect(result).toEqual(payload);
    expect(mockService.getHealth).toHaveBeenCalled();
  });
});
