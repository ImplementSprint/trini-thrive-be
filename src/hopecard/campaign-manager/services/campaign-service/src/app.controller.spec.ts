import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();
    appController = app.get<AppController>(AppController);
  });

  it('getStatus returns ok status with message and timestamp', () => {
    const result = appController.getStatus();
    expect(result.status).toBe('ok');
    expect(result.message).toBe('Campaign Manager Backend API');
    expect(typeof result.timestamp).toBe('string');
  });
});
