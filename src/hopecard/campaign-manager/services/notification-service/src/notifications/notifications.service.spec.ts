import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';

const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}));

const mockConfig: Record<string, string> = {
  SMTP_HOST: 'smtp.test.com',
  SMTP_PORT: '465',
  SMTP_SECURE: 'true',
  SMTP_USER: 'user@test.com',
  SMTP_PASSWORD: 'pass',
  SMTP_FROM: 'noreply@test.com',
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    mockSendMail.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: ConfigService,
          useValue: { get: (k: string) => mockConfig[k] },
        },
      ],
    }).compile();
    service = module.get<NotificationsService>(NotificationsService);
  });

  it('returns success with messageId on successful send', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'msg-123' });
    const result = await service.sendEmail(
      'to@test.com',
      'Hello',
      '<p>body</p>',
    );
    expect(result).toEqual({ success: true, messageId: 'msg-123' });
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'noreply@test.com',
        to: 'to@test.com',
        subject: 'Hello',
        html: '<p>body</p>',
      }),
    );
  });

  it('returns failure with error message when transport throws', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP connection refused'));
    const result = await service.sendEmail(
      'to@test.com',
      'Hello',
      '<p>body</p>',
    );
    expect(result).toEqual({
      success: false,
      error: 'SMTP connection refused',
    });
  });

  it('uses SMTP_FROM env var as from address', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'id' });
    await service.sendEmail('x@y.com', 'sub', 'html');
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'noreply@test.com' }),
    );
  });
});
