import { getStorageUrl } from './storage';

describe('getStorageUrl', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co' };
    delete process.env.SUPABASE_URL;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns null for null key', () => {
    expect(getStorageUrl('campaigns', null)).toBeNull();
  });

  it('returns null for undefined key', () => {
    expect(getStorageUrl('campaigns', undefined)).toBeNull();
  });

  it('returns null for empty string key', () => {
    expect(getStorageUrl('campaigns', '')).toBeNull();
  });

  it('returns null for whitespace-only key', () => {
    expect(getStorageUrl('campaigns', '  ')).toBeNull();
  });

  it('returns null when no Supabase URL env var is set', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(getStorageUrl('campaigns', 'image.jpg')).toBeNull();
  });

  it('builds correct URL for non-campaigns bucket', () => {
    const url = getStorageUrl('profile-photos', 'user/photo.jpg');
    expect(url).toBe('https://test.supabase.co/storage/v1/object/public/profile-photos/user/photo.jpg');
  });

  it('maps campaigns bucket to camp-man-files and adds prefix', () => {
    const url = getStorageUrl('campaigns', 'image.jpg');
    expect(url).toContain('camp-man-files');
    expect(url).toContain('cover-images/campaigns/image.jpg');
  });

  it('does not double-add prefix when already present', () => {
    const url = getStorageUrl('campaigns', 'cover-images/campaigns/image.jpg');
    const count = (url ?? '').split('cover-images/campaigns/').length - 1;
    expect(count).toBe(1);
  });

  it('strips path traversal sequences', () => {
    const url = getStorageUrl('profile-photos', '../../../etc/passwd');
    expect(url).not.toContain('..');
  });

  it('returns null for sanitized empty path', () => {
    expect(getStorageUrl('campaigns', 'cover-images/campaigns/')).toBeNull();
  });

  it('prefers SUPABASE_URL over NEXT_PUBLIC_SUPABASE_URL', () => {
    process.env.SUPABASE_URL = 'https://primary.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fallback.supabase.co';
    const url = getStorageUrl('profile-photos', 'photo.jpg');
    expect(url).toContain('primary.supabase.co');
  });

  it('strips trailing slash from base URL', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co/';
    const url = getStorageUrl('profile-photos', 'photo.jpg');
    expect(url).not.toContain('//storage');
  });
});
