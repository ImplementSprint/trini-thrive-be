import { sendApprovalEmail, sendRejectionEmail } from './email';

const mockSendMail = jest.fn().mockResolvedValue({});
const mockCreateTransport = jest.fn().mockReturnValue({ sendMail: mockSendMail });

jest.mock('nodemailer', () => ({
  createTransport: (...args: any[]) => mockCreateTransport(...args),
}));

const SMTP_ENV = {
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '465',
  SMTP_SECURE: 'true',
  SMTP_USER: 'test@example.com',
  SMTP_PASSWORD: 'secret',
  SMTP_FROM: 'HopeCard Test',
};

describe('sendApprovalEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(process.env, SMTP_ENV);
  });

  afterEach(() => {
    for (const key of Object.keys(SMTP_ENV)) {
      delete process.env[key];
    }
  });

  it('sends an approval email and returns true', async () => {
    const result = await sendApprovalEmail('user@example.com', {
      name: 'Juan dela Cruz',
      role: 'beneficiary',
    });

    expect(result).toBe(true);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.to).toBe('user@example.com');
    expect(call.subject).toBe('Your HopeCard application has been approved');
    expect(call.html).toContain('Juan dela Cruz');
    expect(call.html).toContain('beneficiary');
  });

  it('returns true and logs to console when SMTP is not configured', async () => {
    delete process.env.SMTP_HOST;
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await sendApprovalEmail('user@example.com', {
      name: 'Juan',
      role: 'beneficiary',
    });

    expect(result).toBe(true);
    expect(mockSendMail).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('SMTP not configured'));
    consoleSpy.mockRestore();
  });

  it('returns false when sendMail throws', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP error'));

    const result = await sendApprovalEmail('user@example.com', {
      name: 'Juan',
      role: 'beneficiary',
    });

    expect(result).toBe(false);
  });
});

describe('sendRejectionEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(process.env, SMTP_ENV);
  });

  afterEach(() => {
    for (const key of Object.keys(SMTP_ENV)) {
      delete process.env[key];
    }
  });

  it('sends a rejection email with reason and returns true', async () => {
    const result = await sendRejectionEmail('user@example.com', {
      name: 'Maria Santos',
      role: 'campaign manager',
      reason: 'Incomplete documents',
    });

    expect(result).toBe(true);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.to).toBe('user@example.com');
    expect(call.subject).toBe('Your HopeCard application was not approved');
    expect(call.html).toContain('Maria Santos');
    expect(call.html).toContain('campaign manager');
    expect(call.html).toContain('Incomplete documents');
  });

  it('sends a rejection email without reason and returns true', async () => {
    const result = await sendRejectionEmail('user@example.com', {
      name: 'Maria Santos',
      role: 'digital donor',
    });

    expect(result).toBe(true);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).not.toContain('Reason');
  });

  it('returns true and logs to console when SMTP is not configured', async () => {
    delete process.env.SMTP_HOST;
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await sendRejectionEmail('user@example.com', {
      name: 'Maria',
      role: 'beneficiary',
      reason: 'Fraud',
    });

    expect(result).toBe(true);
    expect(mockSendMail).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('returns false when sendMail throws', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP error'));

    const result = await sendRejectionEmail('user@example.com', {
      name: 'Maria',
      role: 'digital donor',
    });

    expect(result).toBe(false);
  });
});
