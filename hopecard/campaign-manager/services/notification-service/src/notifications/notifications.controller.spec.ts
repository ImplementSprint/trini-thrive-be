import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  const mockService = { sendEmail: jest.fn() };

  beforeEach(async () => {
    mockService.sendEmail.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: mockService }],
    }).compile();
    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('delegates to service and returns result', async () => {
    mockService.sendEmail.mockResolvedValue({ success: true, messageId: 'id-1' });
    const body = { to: 'a@b.com', subject: 'Sub', html: '<p/>' };
    const result = await controller.sendEmail(body);
    expect(result).toEqual({ success: true, messageId: 'id-1' });
    expect(mockService.sendEmail).toHaveBeenCalledWith('a@b.com', 'Sub', '<p/>');
  });

  it('passes through failure response from service', async () => {
    mockService.sendEmail.mockResolvedValue({ success: false, error: 'SMTP error' });
    const result = await controller.sendEmail({ to: 'x@y.com', subject: 'S', html: 'h' });
    expect(result.success).toBe(false);
  });
});
