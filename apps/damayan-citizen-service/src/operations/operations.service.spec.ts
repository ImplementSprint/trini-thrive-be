import { Test, TestingModule } from '@nestjs/testing';
import { OperationsService } from './operations.service';
import { SupabaseService } from '@app/supabase';

describe('OperationsService', () => {
  let service: OperationsService;
  const mockSupabase = { getClient: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OperationsService,
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    }).compile();

    service = module.get<OperationsService>(OperationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
