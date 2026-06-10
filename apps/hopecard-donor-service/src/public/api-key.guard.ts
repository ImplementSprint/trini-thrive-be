import {
  CanActivate, ExecutionContext, Injectable,
  UnauthorizedException, HttpException, HttpStatus,
} from '@nestjs/common';
import { supabase } from '@app/common/supabase-client';

interface PartnerKey {
  id: string;
  daily_limit: number;
}

// In-memory counter: Map<"keyId:YYYY-MM-DD", number>
const requestCounts = new Map<string, number>();

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const apiKey = req.headers['x-api-key'] as string | undefined;

    if (!apiKey) {
      throw new UnauthorizedException('Missing X-Api-Key header');
    }

    let data: PartnerKey | null;
    try {
      const result = await supabase
        .from('partner_api_keys')
        .select('id, daily_limit')
        .eq('key', apiKey)
        .eq('is_active', true)
        .maybeSingle();
      if (result.error || !result.data) {
        throw new UnauthorizedException('Invalid or inactive API key');
      }
      data = result.data as PartnerKey;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    const partner = data;
    const bucket = `${partner.id}:${todayUtc()}`;
    const count = (requestCounts.get(bucket) ?? 0) + 1;
    requestCounts.set(bucket, count);

    if (count > partner.daily_limit) {
      throw new HttpException(
        `Daily request limit of ${partner.daily_limit} exceeded`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
