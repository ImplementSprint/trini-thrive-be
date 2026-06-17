import { Test, TestingModule } from '@nestjs/testing';
import { OperationsService } from './operations.service';
import { SupabaseService } from '@app/supabase';

describe('OperationsService', () => {
  let service: OperationsService;

  const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    storage: {
      from: jest.fn().mockReturnValue({
        createSignedUploadUrl: jest.fn(),
        createSignedUrl: jest.fn(),
      }),
    },
    rpc: jest.fn(),
  };

  const mockSupabaseService = {
    getClient: jest.fn().mockReturnValue(mockSupabaseClient),
    getAdminClient: jest.fn().mockReturnValue(mockSupabaseClient),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OperationsService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<OperationsService>(OperationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findInventory', () => {
    it('should return inventory data', async () => {
      mockSupabaseClient.order.mockResolvedValue({ data: [{ id: '1', name: 'Water' }], error: null });
      const result = await service.findInventory();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].id).toBe('1');
    });
  });

  describe('createDisasterEvent', () => {
    it('should create an event', async () => {
      mockSupabaseClient.single.mockResolvedValue({ data: { id: 'evt-1' }, error: null });
      const dto = { name: 'Typhoon Haiyan', type: 'typhoon', severity: 'critical', locationName: 'Tacloban' };
      const result = await service.createDisasterEvent(dto as any);
      expect(result).toBeDefined();
      expect(result.id).toBe('evt-1');
    });
  });
});
