import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';

import { ApiGatewayService } from './api-gateway.service';
import { HEALTH_SERVICE } from '../shared/tokens';

describe('ApiGatewayService', () => {
  let service: ApiGatewayService;
  const send = jest.fn();

  beforeEach(async () => {
    send.mockReset();

    const testingModule: TestingModule = await Test.createTestingModule({
      providers: [
        ApiGatewayService,
        {
          provide: HEALTH_SERVICE,
          useValue: {
            send,
          },
        },
      ],
    }).compile();

    service = testingModule.get<ApiGatewayService>(ApiGatewayService);
  });

  it('returns the health payload from the microservice', async () => {
    send.mockReturnValue(
      of({
        status: 'ok',
        service: 'beneficiary-health-service',
      }),
    );

    await expect(service.getHealth()).resolves.toEqual(
      expect.objectContaining({
        status: 'ok',
        service: 'beneficiary-health-service',
      }),
    );
  });

  it('maps microservice failures to 503 errors', async () => {
    send.mockReturnValue(throwError(() => new Error('unavailable')));

    await expect(service.getHealth()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
