import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

import { HEALTH_PATTERN, HEALTH_SERVICE } from '../shared/tokens';

@Injectable()
export class ApiGatewayService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  constructor(
    @Inject(HEALTH_SERVICE) private readonly healthClient: ClientProxy,
  ) {}

  async onApplicationBootstrap() {
    await this.healthClient.connect();
  }

  async onApplicationShutdown() {
    await this.healthClient.close();
  }

  async getHealth() {
    try {
      return await firstValueFrom(
        this.healthClient.send(HEALTH_PATTERN, {}).pipe(timeout(3000)),
      );
    } catch {
      throw new ServiceUnavailableException(
        'Health microservice is unavailable',
      );
    }
  }
}
