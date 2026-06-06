import {
  getSupabaseConfig,
  supabaseRequest,
  getRecordId,
  getRecordTitle,
  findHopecardRecordByTitle,
} from './supabase-helpers';

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  };
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('getSupabaseConfig', () => {
  it('returns url and key from primary env vars', () => {
    const config = getSupabaseConfig();
    expect(config.url).toBe('https://test.supabase.co');
    expect(config.key).toBe('service-key');
  });

  it('falls back to NEXT_PUBLIC_SUPABASE_URL when SUPABASE_URL is absent', () => {
    delete process.env.SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fallback.supabase.co';
    const config = getSupabaseConfig();
    expect(config.url).toBe('https://fallback.supabase.co');
  });

  it('falls back to SUPABASE_ANON_KEY when SERVICE_ROLE_KEY is absent', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    const config = getSupabaseConfig();
    expect(config.key).toBe('anon-key');
  });

  it('throws when URL is missing', () => {
    delete process.env.SUPABASE_URL;
    expect(() => getSupabaseConfig()).toThrow('Missing Supabase');
  });

  it('throws when key is missing', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => getSupabaseConfig()).toThrow('Missing Supabase');
  });

  it('treats whitespace-only values as missing', () => {
    process.env.SUPABASE_URL = '   ';
    expect(() => getSupabaseConfig()).toThrow();
  });
});

describe('supabaseRequest', () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  it('makes a GET request and returns parsed JSON', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify([{ id: 'r1' }])),
    });
    const result = await supabaseRequest<{ id: string }[]>('items?limit=1');
    expect(result).toEqual([{ id: 'r1' }]);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/items'),
      expect.objectContaining({ headers: expect.objectContaining({ apikey: 'service-key' }) }),
    );
  });

  it('returns undefined for 204 No Content', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204, text: () => Promise.resolve('') });
    const result = await supabaseRequest('items');
    expect(result).toBeUndefined();
  });

  it('returns undefined for empty response body', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('') });
    const result = await supabaseRequest('items');
    expect(result).toBeUndefined();
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    });
    await expect(supabaseRequest('items')).rejects.toThrow('Internal Server Error');
  });

  it('throws generic message on non-ok with empty body', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve(''),
    });
    await expect(supabaseRequest('items')).rejects.toThrow('status 500');
  });

  it('throws on invalid JSON response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('not-json{{{'),
    });
    await expect(supabaseRequest('items')).rejects.toThrow('Failed to parse');
  });

  it('passes additional init options (method, body, headers)', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204, text: () => Promise.resolve('') });
    await supabaseRequest('items', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ name: 'x' }),
    });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'x' }) }),
    );
  });
});

describe('getRecordId', () => {
  it('returns id from id field', () => {
    expect(getRecordId({ id: 'abc' })).toBe('abc');
  });

  it('returns id from hopecard_id field when id is absent', () => {
    expect(getRecordId({ hopecard_id: 'hc-1' })).toBe('hc-1');
  });

  it('returns null when no id field present', () => {
    expect(getRecordId({ name: 'foo' })).toBeNull();
  });

  it('returns null for empty string id', () => {
    expect(getRecordId({ id: '' })).toBeNull();
  });
});

describe('getRecordTitle', () => {
  it('returns title from title field', () => {
    expect(getRecordTitle({ title: 'My Campaign' })).toBe('My Campaign');
  });

  it('returns title from name field when title is absent', () => {
    expect(getRecordTitle({ name: 'My Name' })).toBe('My Name');
  });

  it('returns title from campaign_title field', () => {
    expect(getRecordTitle({ campaign_title: 'Camp Title' })).toBe('Camp Title');
  });

  it('returns null when no title field present', () => {
    expect(getRecordTitle({ id: 'x' })).toBeNull();
  });

  it('returns null for empty string title', () => {
    expect(getRecordTitle({ title: '' })).toBeNull();
  });
});

describe('findHopecardRecordByTitle', () => {
  const records = [
    { id: 'r1', title: 'Help the Flood Victims' },
    { id: 'r2', title: 'Education Fund' },
    { id: 'r3', title: 'Senior Care Program' },
  ];

  it('finds record by exact title match', () => {
    const result = findHopecardRecordByTitle(records, 'Education Fund');
    expect(result?.id).toBe('r2');
  });

  it('finds record by case-insensitive match', () => {
    const result = findHopecardRecordByTitle(records, 'education fund');
    expect(result?.id).toBe('r2');
  });

  it('finds record by loose match (ignoring punctuation)', () => {
    const result = findHopecardRecordByTitle(records, 'SeniorCareProgram');
    expect(result?.id).toBe('r3');
  });

  it('finds record by partial substring match', () => {
    const result = findHopecardRecordByTitle(records, 'Flood');
    expect(result?.id).toBe('r1');
  });

  it('returns null when no record matches', () => {
    const result = findHopecardRecordByTitle(records, 'Completely Unrelated');
    expect(result).toBeNull();
  });

  it('returns null for empty records array', () => {
    expect(findHopecardRecordByTitle([], 'Any')).toBeNull();
  });
});
