import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { SupabaseService } from '@app/supabase';

describe('HealthService', () => {
  let service: HealthService;
  const mockSupabase = { ping: jest.fn().mockResolvedValue(true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    }).compile();
    service = module.get<HealthService>(HealthService);
  });

  it('returns status ok when database ping succeeds', async () => {
    mockSupabase.ping.mockResolvedValue(true);
    const result = await service.getHealth();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('beneficiary-health-service');
    expect(result.checks.database).toBe(true);
  });

  it('returns status degraded when database ping fails', async () => {
    mockSupabase.ping.mockResolvedValue(false);
    const result = await service.getHealth();
    expect(result.status).toBe('degraded');
    expect(result.checks.database).toBe(false);
  });

  it('includes a timestamp string', async () => {
    mockSupabase.ping.mockResolvedValue(true);
    const result = await service.getHealth();
    expect(typeof result.timestamp).toBe('string');
    expect(new Date(result.timestamp).getTime()).not.toBeNaN();
  });
});
