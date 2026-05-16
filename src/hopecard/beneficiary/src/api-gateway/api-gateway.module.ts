import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';
import { AuthModule } from '../auth/auth.module';
import { HEALTH_SERVICE } from '../shared/tokens';

@Module({
  imports: [
    AuthModule,
    ClientsModule.registerAsync([
      {
        name: HEALTH_SERVICE,
        useFactory: () => ({
          transport: Transport.TCP,
          options: {
            host: process.env.HEALTH_SERVICE_HOST ?? '127.0.0.1',
            port: Number(process.env.HEALTH_SERVICE_PORT ?? 4001),
          },
        }),
      },
    ]),
  ],
  controllers: [ApiGatewayController],
  providers: [ApiGatewayService],
})
export class ApiGatewayModule {}
