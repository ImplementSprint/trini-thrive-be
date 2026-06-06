import {
  sendAccountStatusEmail,
  sendAccountReactivationEmail,
  sendOTPEmail,
  sendConfirmationEmail,
} from './email';

const mockSendMail = jest.fn().mockResolvedValue({ response: 'OK' });
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({ sendMail: (...args: any[]) => mockSendMail(...args) }),
}));

const SMTP_ENV = {
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '465',
  SMTP_SECURE: 'true',
  SMTP_USER: 'test@example.com',
  SMTP_PASSWORD: 'secret',
  SMTP_FROM: 'HopeCard',
};

function setSmtp() { Object.assign(process.env, SMTP_ENV); }
function clearSmtp() { for (const k of Object.keys(SMTP_ENV)) delete process.env[k]; }

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  setSmtp();
});
afterEach(() => {
  clearSmtp();
  jest.restoreAllMocks();
});

// ── sendAccountStatusEmail ──────────────────────────────────────────────────

describe('sendAccountStatusEmail', () => {
  it('sends suspension email and returns true', async () => {
    const result = await sendAccountStatusEmail('user@test.com', {
      firstName: 'Ana',
      status: 'suspended',
      reason: 'Policy violation',
      expiresAt: null,
    });
    expect(result).toBe(true);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.subject).toContain('suspended');
    expect(call.html).toContain('Ana');
  });

  it('sends ban email and returns true', async () => {
    const result = await sendAccountStatusEmail('user@test.com', {
      firstName: 'Juan',
      status: 'banned',
      reason: 'Fraud',
      expiresAt: null,
    });
    expect(result).toBe(true);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.subject).toContain('banned');
  });

  it('includes expiry date when expiresAt is set', async () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const result = await sendAccountStatusEmail('user@test.com', {
      firstName: 'Ana',
      status: 'suspended',
      reason: 'Policy',
      expiresAt: future,
    });
    expect(result).toBe(true);
  });

  it('falls back to console when SMTP is not configured', async () => {
    clearSmtp();
    const result = await sendAccountStatusEmail('user@test.com', {
      firstName: 'Ana', status: 'banned', reason: 'Fraud', expiresAt: null,
    });
    expect(result).toBe(true);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('returns false when sendMail throws', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP error'));
    const result = await sendAccountStatusEmail('user@test.com', {
      firstName: 'Ana', status: 'banned', reason: 'Fraud', expiresAt: null,
    });
    expect(result).toBe(false);
  });
});

// ── sendAccountReactivationEmail ────────────────────────────────────────────

describe('sendAccountReactivationEmail', () => {
  it('sends reactivation email for suspension and returns true', async () => {
    const result = await sendAccountReactivationEmail('user@test.com', {
      firstName: 'Maria', previousStatus: 'suspended', reason: 'Cleared',
    });
    expect(result).toBe(true);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.subject).toContain('reactivated');
    expect(call.html).toContain('Maria');
  });

  it('sends reactivation email for ban', async () => {
    const result = await sendAccountReactivationEmail('user@test.com', {
      firstName: 'Jose', previousStatus: 'banned', reason: 'Appeal approved',
    });
    expect(result).toBe(true);
  });

  it('falls back to console when SMTP is not configured', async () => {
    clearSmtp();
    const result = await sendAccountReactivationEmail('user@test.com', {
      firstName: 'Maria', previousStatus: 'suspended', reason: 'Cleared',
    });
    expect(result).toBe(true);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('returns false when sendMail throws', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP error'));
    const result = await sendAccountReactivationEmail('user@test.com', {
      firstName: 'Maria', previousStatus: 'suspended', reason: 'Cleared',
    });
    expect(result).toBe(false);
  });
});

// ── sendOTPEmail ─────────────────────────────────────────────────────────────

describe('sendOTPEmail', () => {
  it('sends OTP email and returns true', async () => {
    mockSendMail.mockResolvedValueOnce({ response: 'OK' });
    const result = await sendOTPEmail('admin@test.com', '123456');
    expect(result).toBe(true);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.subject).toContain('OTP');
    expect(call.html).toContain('123456');
  });

  it('falls back to console when SMTP is not configured', async () => {
    clearSmtp();
    const result = await sendOTPEmail('admin@test.com', '654321');
    expect(result).toBe(true);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('returns false when sendMail throws', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP error'));
    const result = await sendOTPEmail('admin@test.com', '000000');
    expect(result).toBe(false);
  });
});

// ── sendConfirmationEmail ───────────────────────────────────────────────────

describe('sendConfirmationEmail', () => {
  it('sends confirmation email and returns true', async () => {
    const result = await sendConfirmationEmail('user@test.com', {
      name: 'Ana Cruz',
      confirmationUrl: 'https://hopecard.app/confirm?token=abc',
    });
    expect(result).toBe(true);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.to).toBe('user@test.com');
    expect(call.html).toContain('Ana Cruz');
    expect(call.html).toContain('confirm');
  });

  it('falls back to console when SMTP is not configured', async () => {
    clearSmtp();
    const result = await sendConfirmationEmail('user@test.com', {
      name: 'Ana',
      confirmationUrl: 'https://hopecard.app/confirm?token=xyz',
    });
    expect(result).toBe(true);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('returns false when sendMail throws', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP error'));
    const result = await sendConfirmationEmail('user@test.com', {
      name: 'Ana',
      confirmationUrl: 'https://hopecard.app/confirm?token=zzz',
    });
    expect(result).toBe(false);
  });
});
