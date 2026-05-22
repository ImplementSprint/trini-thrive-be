import { Injectable, HttpException, Inject, Optional } from '@nestjs/common';
import { TribeClient } from '@implementsprint/sdk';
import { decodeJwt, SignJWT } from 'jose';
import { supabase } from '@app/common/supabase-client';
import { supabaseRequest } from '@app/common/supabase-helpers';
import { ProcedureEventService } from '@app/api-center';

const getJwtSecret = () => new TextEncoder().encode(process.env['JWT_SECRET'] ?? '');

@Injectable()
export class AuthService {
  constructor(
    @Optional() @Inject(TribeClient) private readonly client: TribeClient | null,
    private readonly events: ProcedureEventService,
  ) {}

  async googleGetAuthUrl() {
    if (!this.client) throw new HttpException('Auth service unavailable', 503);
    const redirectUri = `${process.env['NEXT_PUBLIC_APP_URL']}/auth/google/callback`;
    const result = await this.client.gauthGetAuthorizationUrl({
      redirectUri,
      scopes: ['openid', 'email', 'profile'],
      accessType: 'offline',
    });
    return { url: (result as any).authorizationUrl ?? (result as any).url };
  }

  async googleCallback(code: string) {
    if (!this.client) throw new HttpException('Auth service unavailable', 503);
    if (!code) throw new HttpException('Missing authorization code', 400);

    const redirectUri = `${process.env['NEXT_PUBLIC_APP_URL']}/auth/google/callback`;
    const tokens = await this.client.gauthExchangeCode({ code, redirectUri });

    const idToken = (tokens as any).idToken ?? (tokens as any).id_token;
    if (!idToken) throw new HttpException('No ID token returned from Google', 400);

    let email: string, firstName: string, lastName: string, googleSub: string;
    try {
      const claims = decodeJwt(idToken as string);
      email = claims['email'] as string;
      googleSub = claims['sub'] as string;
      const fullName = ((claims['name'] as string) ?? '').trim();
      const parts = fullName.split(' ');
      firstName = parts[0] ?? '';
      lastName = parts.slice(1).join(' ');
    } catch {
      throw new HttpException('Failed to decode Google ID token', 400);
    }

    if (!email) throw new HttpException('No email in Google token', 400);

    // Find or create a Supabase auth user for this Google account
    const { data: listData } = await supabase.auth.admin.listUsers();
    let authUserId: string;
    const existing = listData?.users?.find((u) => u.email === email);

    if (existing) {
      authUserId = existing.id;
    } else {
      const { data: created, error } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { name: `${firstName} ${lastName}`.trim(), google_sub: googleSub },
      });
      if (error || !created.user) throw new HttpException('Failed to create user account', 500);
      authUserId = created.user.id;
    }

    // Find or create the donor profile row
    const profiles = await supabaseRequest<{ id: string; first_name: string; status: string }[]>(
      `digital_donor_profiles?auth_user_id=eq.${authUserId}&select=id,first_name,status&limit=1`,
    );

    let isNew = false;
    if (profiles.length === 0) {
      await supabaseRequest('digital_donor_profiles', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          auth_user_id: authUserId,
          email,
          first_name: firstName,
          last_name: lastName,
          status: 'pending',
          created_at: new Date().toISOString(),
        }),
      });
      isNew = true;
    }

    this.events.emit(
      isNew ? 'hopecard.donor.google_registered' : 'hopecard.donor.google_login',
      { authUserId, email },
      { partitionKey: authUserId, sourceServiceId: 'hopecard-donor-service' },
    );

    const token = await new SignJWT({
      sub: authUserId,
      email,
      name: `${firstName} ${lastName}`.trim(),
      persona: 'donor',
      system: 'hopecard',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(getJwtSecret());

    return { token, isNew, authUserId };
  }
}
