import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { ProcedureEventService } from '@app/api-center';

type SbError = { message: string } | null;

interface ProfileRow {
  id: string;
}

interface DocumentRow {
  id: string;
  document_key: string | null;
  status: string;
  beneficiary_profile_id: string;
}

interface InsertedDocRow {
  id: string;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'pdf']);

@Injectable()
export class IdentityDocumentsService {
  constructor(private readonly events: ProcedureEventService) {}
  private get admin() {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }

  private async getProfile(authUserId: string) {
    const { data, error } = (await this.admin
      .from('beneficiary_profiles')
      .select('id')
      .eq('auth_user_id', authUserId)
      .single()) as { data: ProfileRow | null; error: SbError };
    if (error || !data)
      throw new NotFoundException('Beneficiary profile not found');
    return data;
  }

  async uploadDocument(
    authUserId: string,
    file: Express.Multer.File,
    label?: string,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > MAX_BYTES)
      throw new BadRequestException('File must be under 5 MB');
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.has(ext))
      throw new BadRequestException('File must be a JPG, PNG, or PDF');

    const profile = await this.getProfile(authUserId);
    const filename = `${profile.id}/${Date.now()}-${label ?? 'document'}.${ext}`;

    const { data, error } = (await this.admin.storage
      .from('beneficiary-ids')
      .upload(filename, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      })) as { data: { path: string } | null; error: SbError };

    if (error || !data)
      throw new BadRequestException(
        `Upload failed: ${error?.message ?? 'unknown'}`,
      );

    const uploadedPath = data.path;

    const {
      data: { publicUrl },
    } = this.admin.storage.from('beneficiary-ids').getPublicUrl(filename);

    const docLabel = label ?? 'Identity Document';
    const { data: inserted } = (await this.admin
      .from('beneficiary_identity_documents')
      .insert({
        beneficiary_profile_id: profile.id,
        document_key: uploadedPath,
        document_url: publicUrl,
        label: docLabel,
        status: 'pending',
      })
      .select('id')
      .single()) as { data: InsertedDocRow | null; error: SbError };

    this.events.emit(
      'hopecard.document.submitted',
      {
        authUserId,
        beneficiaryProfileId: profile.id,
        documentId: inserted?.id ?? null,
        label: docLabel,
        path: uploadedPath,
      },
      {
        partitionKey: profile.id,
        sourceServiceId: 'hopecard-beneficiary-service',
      },
    );
    return {
      success: true,
      path: uploadedPath,
      url: publicUrl,
      documentKey: uploadedPath,
      documentId: inserted?.id ?? null,
      documentLabel: docLabel,
    };
  }

  async getDocuments(authUserId: string) {
    const profile = await this.getProfile(authUserId);
    const { data, error } = (await this.admin
      .from('beneficiary_identity_documents')
      .select('*')
      .eq('beneficiary_profile_id', profile.id)
      .order('created_at', { ascending: false })) as {
      data: Record<string, unknown>[] | null;
      error: SbError;
    };
    if (error) throw new BadRequestException(error.message);
    return { documents: data ?? [] };
  }

  async deleteDocument(authUserId: string, documentId: string) {
    const profile = await this.getProfile(authUserId);
    const { data: doc, error } = (await this.admin
      .from('beneficiary_identity_documents')
      .select('id, document_key, status, beneficiary_profile_id')
      .eq('id', documentId)
      .single()) as { data: DocumentRow | null; error: SbError };
    if (error || !doc) throw new NotFoundException('Document not found');
    if (doc.beneficiary_profile_id !== profile.id)
      throw new ForbiddenException('Not your document');
    if (doc.status !== 'pending')
      throw new ForbiddenException('Only pending documents can be deleted');

    if (doc.document_key) {
      await this.admin.storage.from('beneficiary-ids').remove([doc.document_key]);
    }
    await this.admin.from('beneficiary_identity_documents').delete().eq('id', documentId);
    this.events.emit(
      'hopecard.document.deleted',
      { authUserId, beneficiaryProfileId: profile.id, documentId },
      {
        partitionKey: profile.id,
        sourceServiceId: 'hopecard-beneficiary-service',
      },
    );
    return { success: true };
  }

  async getSignedUrl(authUserId: string, documentKey: string) {
    await this.getProfile(authUserId);
    const { data, error } = (await this.admin.storage
      .from('beneficiary-ids')
      .createSignedUrl(documentKey, 60 * 60)) as {
      data: { signedUrl: string } | null;
      error: SbError;
    };
    if (error || !data)
      throw new BadRequestException(
        error?.message ?? 'Failed to create signed URL',
      );
    return { signedUrl: data.signedUrl };
  }
}
