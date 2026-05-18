import { AuthService } from './auth.service';

// jose is ESM-only; mock it to capture the payload passed to SignJWT
const mockSign = jest.fn().mockResolvedValue('mock.jwt.token');
const mockSetExpirationTime = jest.fn().mockReturnThis();
const mockSetProtectedHeader = jest.fn().mockReturnThis();
let capturedPayload: Record<string, unknown> = {};

jest.mock('jose', () => ({
  SignJWT: jest.fn().mockImplementation((payload: Record<string, unknown>) => {
    capturedPayload = payload;
    return {
      setProtectedHeader: mockSetProtectedHeader,
      setExpirationTime: mockSetExpirationTime,
      sign: mockSign,
    };
  }),
}));

jest.mock('@common/supabase-client', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      admin: { listUsers: jest.fn() },
    },
    from: jest.fn(),
  },
}));

jest.mock('@common/email', () => ({
  sendOTPEmail: jest.fn().mockResolvedValue(true),
}));

describe('AuthService (admin-auth)', () => {
  let service: AuthService;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    capturedPayload = {};
    jest.clearAllMocks();

    // Re-apply the SignJWT mock implementation after clearAllMocks
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SignJWT } = require('jose') as {
      SignJWT: jest.Mock;
    };
    SignJWT.mockImplementation((payload: Record<string, unknown>) => {
      capturedPayload = payload;
      return {
        setProtectedHeader: mockSetProtectedHeader,
        setExpirationTime: mockSetExpirationTime,
        sign: mockSign,
      };
    });
    mockSetProtectedHeader.mockReturnThis();
    mockSetExpirationTime.mockReturnThis();
    mockSign.mockResolvedValue('mock.jwt.token');

    service = new AuthService();
  });

  describe('verifyOTP — JWT payload', () => {
    it('issues a token containing persona: admin and system: hopecard', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { supabase } = require('@common/supabase-client') as {
        supabase: {
          from: jest.Mock;
          auth: { admin: { listUsers: jest.Mock } };
        };
      };

      const otpRecord = {
        id: '1',
        email: 'admin@test.com',
        otp: '123456',
        used: false,
      };

      supabase.from.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        // gt is awaited directly in the "final query" path
        gt: jest.fn().mockResolvedValue({ data: [otpRecord], error: null }),
        update: jest.fn().mockReturnThis(),
        // limit is awaited in the "test query" path
        limit: jest.fn().mockResolvedValue({ data: [otpRecord], error: null }),
      }));

      supabase.auth.admin.listUsers.mockResolvedValue({
        data: {
          users: [
            {
              id: 'user-uuid-123',
              email: 'admin@test.com',
              user_metadata: { name: 'Test Admin' },
            },
          ],
        },
        error: null,
      });

      const result = await service.verifyOTP('admin@test.com', '123456');

      expect(result.success).toBe(true);
      expect(result.token).toBe('mock.jwt.token');

      // Assert the payload passed to SignJWT contains persona and system
      expect(capturedPayload['persona']).toBe('admin');
      expect(capturedPayload['system']).toBe('hopecard');
      expect(capturedPayload['sub']).toBe('user-uuid-123');
      expect(capturedPayload['email']).toBe('admin@test.com');
    });
  });
});
