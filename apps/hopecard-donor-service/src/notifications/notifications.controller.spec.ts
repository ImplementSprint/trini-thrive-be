jest.mock('jose', () => ({ jwtVerify: jest.fn(), SignJWT: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

const mockService = {
  getNotifications: jest.fn(),
  markAllRead: jest.fn(),
  markRead: jest.fn(),
};
const req = { user: { sub: 'user-abc' } } as any;

describe('NotificationsController', () => {
  let controller: NotificationsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: mockService }],
    }).compile();
    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('getNotifications delegates with req.user.sub', async () => {
    mockService.getNotifications.mockResolvedValue({ notifications: [] });
    const result = await controller.getNotifications(req);
    expect(mockService.getNotifications).toHaveBeenCalledWith('user-abc');
    expect(result).toEqual({ notifications: [] });
  });

  it('markAllRead delegates with req.user.sub', async () => {
    mockService.markAllRead.mockResolvedValue({ success: true });
    const result = await controller.markAllRead(req);
    expect(mockService.markAllRead).toHaveBeenCalledWith('user-abc');
    expect(result).toEqual({ success: true });
  });

  it('markRead delegates with id param', async () => {
    mockService.markRead.mockResolvedValue({ success: true });
    const result = await controller.markRead('notif-123');
    expect(mockService.markRead).toHaveBeenCalledWith('notif-123');
    expect(result).toEqual({ success: true });
  });
});
