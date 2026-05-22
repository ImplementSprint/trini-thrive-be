import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProcedureEventService } from '@app/api-center';
import { IdentityDocumentsService } from './identity-documents.service';

// ── Supabase mock ────────────────────────────────────────────────────────────
const mockSingle = jest.fn();
const mockOrder = jest.fn();
const mockStorageUpload = jest.fn();
const mockStorageRemove = jest.fn();
const mockStorageCreateSignedUrl = jest.fn();
const mockStorageGetPublicUrl = jest.fn();

const mockStorageBucket = {
  upload: mockStorageUpload,
  remove: mockStorageRemove,
  createSignedUrl: mockStorageCreateSignedUrl,
  getPublicUrl: mockStorageGetPublicUrl,
};

const mockChain: any = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: mockOrder,
  limit: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  single: mockSingle,
  maybeSingle: jest.fn(),
};

const mockSupabase = {
  from: jest.fn(() => mockChain),
  storage: {
    from: jest.fn(() => mockStorageBucket),
  },
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

const mockEmit = jest.fn();

const makeFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File =>
  ({
    fieldname: 'file',
    originalname: 'doc.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('fake'),
    size: 1024,
    ...overrides,
  } as Express.Multer.File);

describe('IdentityDocumentsService', () => {
  let service: IdentityDocumentsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockChain.select.mockReturnThis();
    mockChain.eq.mockReturnThis();
    mockChain.order.mockReturnThis();
    mockChain.delete.mockReturnThis();
    mockChain.insert.mockReturnThis();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc-key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentityDocumentsService,
        { provide: ProcedureEventService, useValue: { emit: mockEmit } },
      ],
    }).compile();
    service = module.get<IdentityDocumentsService>(IdentityDocumentsService);
  });

  // ── uploadDocument ───────────────────────────────────────────────────────────
  describe('uploadDocument', () => {
    it('throws BadRequestException when no file', async () => {
      await expect(service.uploadDocument('uid-1', null as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when file is too large', async () => {
      const file = makeFile({ size: 6 * 1024 * 1024 });
      await expect(service.uploadDocument('uid-1', file)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException for disallowed extension', async () => {
      const file = makeFile({ originalname: 'doc.exe' });
      await expect(service.uploadDocument('uid-1', file)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when profile not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
      const file = makeFile();
      await expect(service.uploadDocument('uid-1', file)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when storage upload fails', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'p-1' }, error: null });
      mockStorageUpload.mockResolvedValueOnce({ data: null, error: { message: 'upload failed' } });
      const file = makeFile();
      await expect(service.uploadDocument('uid-1', file)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('uploads document and emits event', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' }, error: null }) // getProfile
        .mockResolvedValueOnce({ data: { id: 'doc-1' }, error: null }); // insert

      mockStorageUpload.mockResolvedValueOnce({ data: { path: 'p-1/123-document.jpg' }, error: null });
      mockStorageGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/doc.jpg' } });

      const file = makeFile();
      const result = await service.uploadDocument('uid-1', file, 'ID Card');

      expect(result.success).toBe(true);
      expect(result.documentLabel).toBe('ID Card');
      expect(mockEmit).toHaveBeenCalledWith(
        'hopecard.document.submitted',
        expect.objectContaining({ label: 'ID Card' }),
        expect.any(Object),
      );
    });

    it('uses default label when none provided', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'doc-2' }, error: null });

      mockStorageUpload.mockResolvedValueOnce({ data: { path: 'p-1/123-document.jpg' }, error: null });
      mockStorageGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/doc.jpg' } });

      const file = makeFile({ originalname: 'proof.pdf' });
      const result = await service.uploadDocument('uid-1', file);

      expect(result.documentLabel).toBe('Identity Document');
    });

    it('handles png and pdf extensions', async () => {
      for (const ext of ['png', 'pdf']) {
        jest.clearAllMocks();
        mockChain.select.mockReturnThis();
        mockChain.eq.mockReturnThis();
        mockChain.insert.mockReturnThis();

        mockSingle
          .mockResolvedValueOnce({ data: { id: 'p-1' }, error: null })
          .mockResolvedValueOnce({ data: { id: 'doc-x' }, error: null });
        mockStorageUpload.mockResolvedValueOnce({ data: { path: `p-1/file.${ext}` }, error: null });
        mockStorageGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn/file' } });

        const file = makeFile({ originalname: `file.${ext}`, mimetype: ext === 'pdf' ? 'application/pdf' : 'image/png' });
        const result = await service.uploadDocument('uid-1', file);
        expect(result.success).toBe(true);
      }
    });
  });

  // ── getDocuments ─────────────────────────────────────────────────────────────
  describe('getDocuments', () => {
    it('returns documents list', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'p-1' }, error: null });
      mockOrder.mockResolvedValueOnce({ data: [{ id: 'doc-1', label: 'ID' }], error: null });

      const result = await service.getDocuments('uid-1');
      expect(result.documents).toHaveLength(1);
    });

    it('returns empty array on null data', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'p-1' }, error: null });
      mockOrder.mockResolvedValueOnce({ data: null, error: null });

      const result = await service.getDocuments('uid-1');
      expect(result.documents).toEqual([]);
    });

    it('throws BadRequestException on DB error', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'p-1' }, error: null });
      mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'db error' } });

      await expect(service.getDocuments('uid-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when profile not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'err' } });
      await expect(service.getDocuments('uid-x')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── deleteDocument ───────────────────────────────────────────────────────────
  describe('deleteDocument', () => {
    it('deletes document and emits event', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' }, error: null }) // getProfile
        .mockResolvedValueOnce({ data: { id: 'doc-1', document_key: 'p-1/doc.jpg', status: 'pending', beneficiary_profile_id: 'p-1' }, error: null }); // fetch doc

      mockStorageRemove.mockResolvedValueOnce({ error: null });

      const result = await service.deleteDocument('uid-1', 'doc-1');
      expect(result.success).toBe(true);
      expect(mockEmit).toHaveBeenCalledWith(
        'hopecard.document.deleted',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('throws NotFoundException when document not found', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      await expect(service.deleteDocument('uid-1', 'doc-x')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when document belongs to another profile', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'doc-1', document_key: 'p-2/doc.jpg', status: 'pending', beneficiary_profile_id: 'p-2' }, error: null });

      await expect(service.deleteDocument('uid-1', 'doc-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when document is not pending', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'doc-1', document_key: 'p-1/doc.jpg', status: 'approved', beneficiary_profile_id: 'p-1' }, error: null });

      await expect(service.deleteDocument('uid-1', 'doc-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('skips storage delete when document_key is falsy', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'p-1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'doc-1', document_key: null, status: 'pending', beneficiary_profile_id: 'p-1' }, error: null });

      const result = await service.deleteDocument('uid-1', 'doc-1');
      expect(result.success).toBe(true);
      expect(mockStorageRemove).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when profile not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'err' } });
      await expect(service.deleteDocument('uid-x', 'doc-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── getSignedUrl ─────────────────────────────────────────────────────────────
  describe('getSignedUrl', () => {
    it('returns signed URL', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'p-1' }, error: null });
      mockStorageCreateSignedUrl.mockResolvedValueOnce({ data: { signedUrl: 'https://signed.url/doc' }, error: null });

      const result = await service.getSignedUrl('uid-1', 'p-1/doc.jpg');
      expect(result.signedUrl).toBe('https://signed.url/doc');
    });

    it('throws BadRequestException on storage error', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'p-1' }, error: null });
      mockStorageCreateSignedUrl.mockResolvedValueOnce({ data: null, error: { message: 'storage error' } });

      await expect(service.getSignedUrl('uid-1', 'p-1/doc.jpg')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when profile not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'err' } });
      await expect(service.getSignedUrl('uid-x', 'key')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
