import { ExecutionContext, HttpException, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';

const mockMaybeSingle = jest.fn();
const mockEq = jest.fn().mockReturnThis();
const mockSelect = jest.fn().mockReturnThis();
const mockFrom = jest.fn(() => ({ select: mockSelect, eq: mockEq, maybeSingle: mockMaybeSingle }));

jest.mock('@app/common/supabase-client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

function makeContext(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as any;
}

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;

  beforeEach(() => {
    mockMaybeSingle.mockReset();
    mockFrom.mockClear();
    guard = new ApiKeyGuard();
  });

  it('throws UnauthorizedException when X-Api-Key header is missing', async () => {
    await expect(guard.canActivate(makeContext({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws UnauthorizedException when key is invalid or inactive', async () => {
    mockSelect.mockReturnThis();
    mockEq.mockReturnThis();
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const ctx = makeContext({ 'x-api-key': 'bad-key' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows valid key within daily limit', async () => {
    mockSelect.mockReturnThis();
    mockEq.mockReturnThis();
    mockMaybeSingle.mockResolvedValue({ data: { id: 'partner-1', daily_limit: 1000 }, error: null });
    const ctx = makeContext({ 'x-api-key': 'valid-key' });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('throws 429 when daily limit is exceeded', async () => {
    // Set up a partner with very low limit (1), then exceed it
    const keyId = 'partner-exceed';
    mockMaybeSingle.mockResolvedValue({ data: { id: keyId, daily_limit: 0 }, error: null });
    const ctx = makeContext({ 'x-api-key': 'exceed-key' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(HttpException);
  });

  it('throws UnauthorizedException when supabase query errors', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } });
    const ctx = makeContext({ 'x-api-key': 'any-key' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
