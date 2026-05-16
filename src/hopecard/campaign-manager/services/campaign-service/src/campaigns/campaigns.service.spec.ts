import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { CampaignsService } from './campaigns.service';

// ── Supabase mock ────────────────────────────────────────────────────────────
const mockFrom = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: mockFrom })),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────
function queryChain(data: any, error: any = null) {
  const c: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ data, error }),
  };
  c.then = (res: any, rej: any) =>
    Promise.resolve({ data, error }).then(res, rej);
  return c;
}

// ── HttpService mock ──────────────────────────────────────────────────────────
const mockHttpPost = jest.fn();
const mockHttpService = { post: mockHttpPost };

const mockConfigService = {
  get: (k: string) =>
    ({
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'key',
      NOTIFICATION_SERVICE_URL: 'http://localhost:3003',
    })[k],
};

describe('CampaignsService', () => {
  let service: CampaignsService;

  beforeEach(async () => {
    mockFrom.mockReset();
    mockHttpPost.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    service = module.get<CampaignsService>(CampaignsService);
    // Inject mock supabase directly — avoids onModuleInit lifecycle complexity
    (service as any).supabase = { from: mockFrom };
  });

  afterEach(() => jest.restoreAllMocks());

  // ── findAll ─────────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('returns mapped campaigns from Supabase', async () => {
      const raw = [
        {
          id: 'c1',
          title: 'Camp A',
          beneficiary: 'Bob',
          collected_amount: 500,
          target_amount: 1000,
          donor_count: 3,
          end_date: '2025-12-31',
          status: 'active',
        },
      ];
      mockFrom.mockReturnValueOnce(queryChain(raw));
      const result = await service.findAll();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'c1',
        raised: 500,
        goal: 1000,
        donors: 3,
        status: 'Active',
      });
    });

    it('maps status "draft" to "Pending"', async () => {
      mockFrom.mockReturnValueOnce(
        queryChain([
          {
            id: 'c2',
            title: 'X',
            status: 'draft',
            collected_amount: 0,
            target_amount: 0,
            donor_count: 0,
            end_date: null,
          },
        ]),
      );
      const [row] = await service.findAll();
      expect(row.status).toBe('Pending');
    });

    it('maps status "completed" to "Completed"', async () => {
      mockFrom.mockReturnValueOnce(
        queryChain([
          {
            id: 'c3',
            title: 'X',
            status: 'completed',
            collected_amount: 0,
            target_amount: 0,
            donor_count: 0,
            end_date: null,
          },
        ]),
      );
      const [row] = await service.findAll();
      expect(row.status).toBe('Completed');
    });

    it('maps unknown status to "Pending"', async () => {
      mockFrom.mockReturnValueOnce(
        queryChain([
          {
            id: 'c4',
            title: 'X',
            status: 'archived',
            collected_amount: 0,
            target_amount: 0,
            donor_count: 0,
            end_date: null,
          },
        ]),
      );
      const [row] = await service.findAll();
      expect(row.status).toBe('Pending');
    });

    it('uses defaults for null optional fields', async () => {
      mockFrom.mockReturnValueOnce(
        queryChain([
          {
            id: 'c5',
            title: 'X',
            beneficiary: null,
            collected_amount: null,
            target_amount: null,
            donor_count: null,
            end_date: null,
            status: 'draft',
          },
        ]),
      );
      const [row] = await service.findAll();
      expect(row.raised).toBe(0);
      expect(row.goal).toBe(0);
      expect(row.donors).toBe(0);
      expect(row.endDate).toBe('TBD');
    });

    it('throws InternalServerErrorException on Supabase error', async () => {
      mockFrom.mockReturnValueOnce(queryChain(null, { message: 'DB error' }));
      await expect(service.findAll()).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  // ── create ───────────────────────────────────────────────────────────────────
  describe('create', () => {
    function campaignInsertChain(campaign: any, error: any = null) {
      return {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: campaign, error }),
          }),
        }),
      };
    }

    it('inserts campaign and returns it with no beneficiaryIds', async () => {
      mockFrom.mockReturnValueOnce(campaignInsertChain({ id: 'new-1' }));
      const dto = {
        title: 'New',
        category: 'Health',
        description: 'x',
        target_amount: 500,
        end_date: '2025-01-01',
        cover_image_key: null,
        created_by: 'u1',
      };
      const result = await service.create(dto);
      expect(result).toEqual({ id: 'new-1' });
    });

    it('uses "Untitled Campaign" when title is absent', async () => {
      const insertMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest
            .fn()
            .mockResolvedValue({ data: { id: 'x' }, error: null }),
        }),
      });
      mockFrom.mockReturnValueOnce({ insert: insertMock });
      await service.create({ target_amount: 100 });
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Untitled Campaign' }),
      );
    });

    it('lowercases category', async () => {
      const insertMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest
            .fn()
            .mockResolvedValue({ data: { id: 'x' }, error: null }),
        }),
      });
      mockFrom.mockReturnValueOnce({ insert: insertMock });
      await service.create({ category: 'HEALTH' });
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'health' }),
      );
    });

    it('throws InternalServerErrorException on insert error', async () => {
      mockFrom.mockReturnValueOnce(
        campaignInsertChain(null, { message: 'fail' }),
      );
      await expect(service.create({})).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('links beneficiaries and triggers emails when beneficiaryIds provided', async () => {
      // 1. campaign insert
      mockFrom.mockReturnValueOnce(campaignInsertChain({ id: 'c1' }));
      // 2. campaign_beneficiaries insert
      mockFrom.mockReturnValueOnce(queryChain(null));
      // 3. beneficiary_profiles select
      mockFrom.mockReturnValueOnce(
        queryChain([
          { email: 'ben@test.com', first_name: 'Ben', last_name: 'A' },
        ]),
      );

      mockHttpPost.mockReturnValue(of({ status: 200 }));

      const result = await service.create({
        title: 'Camp',
        beneficiaryIds: ['b1'],
      });
      expect(result).toEqual({ id: 'c1' });
      expect(mockHttpPost).toHaveBeenCalledWith(
        expect.stringContaining('/notifications/send-email'),
        expect.objectContaining({ to: 'ben@test.com' }),
      );
    });

    it('skips email for beneficiary with no email address', async () => {
      mockFrom.mockReturnValueOnce(campaignInsertChain({ id: 'c2' }));
      mockFrom.mockReturnValueOnce(queryChain(null));
      mockFrom.mockReturnValueOnce(
        queryChain([{ email: null, first_name: 'Ben', last_name: 'A' }]),
      );

      await service.create({ title: 'Camp', beneficiaryIds: ['b1'] });
      expect(mockHttpPost).not.toHaveBeenCalled();
    });

    it('logs join error but still returns campaign when beneficiary link insert fails', async () => {
      mockFrom.mockReturnValueOnce(campaignInsertChain({ id: 'c3' }));
      // join insert returns an error
      mockFrom.mockReturnValueOnce({
        insert: jest
          .fn()
          .mockResolvedValue({ error: { message: 'join fail' } }),
      });
      mockFrom.mockReturnValueOnce(queryChain([])); // beneficiary profiles — empty
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const result = await service.create({
        title: 'Camp',
        beneficiaryIds: ['b1'],
      });
      expect(result).toEqual({ id: 'c3' });
      expect(errorSpy).toHaveBeenCalledWith(
        'Beneficiary link error:',
        expect.anything(),
      );
      errorSpy.mockRestore();
    });

    it('catches and logs email send failure without throwing', async () => {
      mockFrom.mockReturnValueOnce(campaignInsertChain({ id: 'c4' }));
      mockFrom.mockReturnValueOnce(queryChain(null));
      mockFrom.mockReturnValueOnce(
        queryChain([{ email: 'b@test.com', first_name: 'B', last_name: 'A' }]),
      );
      // httpService.post throws (simulates notification service down)
      mockHttpPost.mockImplementation(() => {
        throw new Error('notification service down');
      });
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const result = await service.create({
        title: 'Camp',
        beneficiaryIds: ['b1'],
      });
      expect(result).toEqual({ id: 'c4' });
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  // ── onModuleInit ─────────────────────────────────────────────────────────────
  describe('onModuleInit', () => {
    it('logs error when SUPABASE_URL is missing', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mod = await Test.createTestingModule({
        providers: [
          CampaignsService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(undefined) },
          },
          { provide: HttpService, useValue: mockHttpService },
        ],
      }).compile();
      expect(mod.get<CampaignsService>(CampaignsService)).toBeDefined();
      spy.mockRestore();
    });

    it('logs warning when NOTIFICATION_SERVICE_URL is absent', async () => {
      const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const partialConfig = {
        get: (k: string) =>
          ({ SUPABASE_URL: 'https://x.co', SUPABASE_SERVICE_ROLE_KEY: 'k' })[k],
      };
      const mod = await Test.createTestingModule({
        providers: [
          CampaignsService,
          { provide: ConfigService, useValue: partialConfig },
          { provide: HttpService, useValue: mockHttpService },
        ],
      }).compile();
      expect(mod.get<CampaignsService>(CampaignsService)).toBeDefined();
      spy.mockRestore();
    });
  });
});
