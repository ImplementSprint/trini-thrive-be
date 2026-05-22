import { bootstrapHttpApp } from '@app/common';
import { DamayanDispatcherServiceModule } from './dispatcher-service.module';

process.env.PORT = process.env.DAMAYAN_DISPATCHER_PORT ?? '3203';

void bootstrapHttpApp({
  module: DamayanDispatcherServiceModule,
  loggerName: 'DamayanDispatcherService',
  swaggerTitle: 'Damayan Dispatcher Service',
  swaggerDescription: 'Damayan dispatcher persona backend API',
  defaultPort: 3203,
});
