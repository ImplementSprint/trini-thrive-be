import { TribeRegistrationService } from './tribe-registration.service';

jest.mock('node:fs', () => ({
  readFileSync: jest.fn(() =>
    JSON.stringify({ serviceId: 'svc-1', name: 'TestService', baseUrl: 'http://localhost' }),
  ),
}));

jest.mock('node:path', () => ({ resolve: jest.fn(() => '/fake/tribe-manifest.json') }));

jest.mock('axios', () => ({ post: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockAxios = require('axios') as { post: jest.Mock };

function makeService(configMap: Record<string, string | undefined>): TribeRegistrationService {
  const configService = { get: jest.fn((key: string) => configMap[key]) } as any;
  return new TribeRegistrationService(configService);
}

describe('TribeRegistrationService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('onApplicationBootstrap', () => {
    it('skips registration when API_CENTER_BASE_URL is not set', async () => {
      const service = makeService({ API_CENTER_BASE_URL: undefined });
      await service.onApplicationBootstrap();
      expect(mockAxios.post).not.toHaveBeenCalled();
    });

    it('registers using manifest values when env overrides are absent', async () => {
      mockAxios.post.mockResolvedValue({ status: 200 });
      const service = makeService({ API_CENTER_BASE_URL: 'http://api-center' });
      await service.onApplicationBootstrap();
      expect(mockAxios.post).toHaveBeenCalledWith(
        'http://api-center/api/v1/registry/register',
        expect.objectContaining({ serviceId: 'svc-1', name: 'TestService', baseUrl: 'http://localhost' }),
        expect.objectContaining({ headers: expect.any(Object) }),
      );
    });

    it('prefers env TRIBE_SERVICE_ID over manifest serviceId', async () => {
      mockAxios.post.mockResolvedValue({ status: 200 });
      const service = makeService({
        API_CENTER_BASE_URL: 'http://api-center',
        TRIBE_SERVICE_ID: 'env-svc',
      });
      await service.onApplicationBootstrap();
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ serviceId: 'env-svc' }),
        expect.any(Object),
      );
    });

    it('logs a warning when registration fails', async () => {
      mockAxios.post.mockRejectedValue(new Error('network error'));
      const service = makeService({ API_CENTER_BASE_URL: 'http://api-center' });
      await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    });
  });
});
