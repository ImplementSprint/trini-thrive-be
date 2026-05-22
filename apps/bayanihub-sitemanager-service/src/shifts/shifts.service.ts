import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '@app/supabase';
import { SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class ShiftsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get db(): SupabaseClient {
    const client = this.supabaseService.getClient();
    if (!client) throw new InternalServerErrorException('Database unavailable.');
    return client;
  }

  async getPendingShifts() {
    const client = this.db;
    const { data, error } = await client
      .from('volunteer_shifts')
      .select('id, clock_in, clock_out, status, volunteer_auth_id')
      .in('status', ['pending', 'flagged'])
      .not('clock_out', 'is', null)
      .order('clock_out', { ascending: false });

    if (error) throw error;

    if (data && data.length > 0) {
      const authIds = data.map((d) => d.volunteer_auth_id);
      const { data: profiles } = await client.from('user_profiles').select('auth_user_id, first_name, last_name').in('auth_user_id', authIds);
      return data.map((shift) => {
        const p = profiles?.find((prof) => prof.auth_user_id === shift.volunteer_auth_id);
        return { ...shift, volunteer_name: p ? `${p.first_name} ${p.last_name}` : 'Unknown Volunteer' };
      });
    }

    return data ?? [];
  }

  async approveShift(id: string) {
    const client = this.db;
    const { data: shift, error: fetchErr } = await client.from('volunteer_shifts').select('*').eq('id', id).single();
    if (fetchErr || !shift) throw new NotFoundException('Shift not found');
    if (!shift.clock_out) throw new Error('Cannot approve a shift that is not clocked out');

    const diffMs = new Date(shift.clock_out).getTime() - new Date(shift.clock_in).getTime();
    const totalHours = (diffMs / (1000 * 60 * 60)).toFixed(2);

    const { data: updatedShift, error: updateErr } = await client.from('volunteer_shifts').update({ status: 'approved', total_hours: totalHours }).eq('id', id).select().single();
    if (updateErr) throw updateErr;

    const { data: profile } = await client.from('user_profiles').select('total_volunteer_hours').eq('auth_user_id', shift.volunteer_auth_id).single();
    const newTotal = Number(profile?.total_volunteer_hours ?? 0) + Number(totalHours);
    await client.from('user_profiles').update({ total_volunteer_hours: newTotal }).eq('auth_user_id', shift.volunteer_auth_id);

    try {
      await client.from('bh_notifications').insert({ user_id: shift.volunteer_auth_id, target_role: 'volunteer', title: 'Shift Approved', message: `Your shift has been approved. Total hours added: ${totalHours}.`, type: 'shift_review_status', reference_id: id });
    } catch (err: any) { console.error(`Notification error on shift approval: ${err.message}`); }

    return updatedShift;
  }

  async denyShift(id: string, reason?: string) {
    const client = this.db;
    const allowedReasons = new Set(['incomplete_task', 'suspicious_request', 'no_show']);
    const cleanReason = allowedReasons.has(String(reason ?? '')) ? reason : 'incomplete_task';

    const { data, error } = await client.from('volunteer_shifts').update({ status: 'flagged', flag_reason: cleanReason }).eq('id', id).select().single();

    if (error && /flag_reason|schema cache|column .* does not exist/i.test(error.message)) {
      const fallback = await client.from('volunteer_shifts').update({ status: 'flagged' }).eq('id', id).select().single();
      if (fallback.error) throw fallback.error;
      if (fallback.data) {
        try {
          await client.from('bh_notifications').insert({ user_id: fallback.data.volunteer_auth_id, target_role: 'volunteer', title: 'Shift Flagged / Denied', message: 'Your shift has been flagged by the site manager.', type: 'shift_review_status', reference_id: id });
        } catch (err: any) { console.error(`Notification error on shift denial: ${err.message}`); }
      }
      return fallback.data;
    }

    if (error) throw error;

    if (data) {
      try {
        await client.from('bh_notifications').insert({ user_id: data.volunteer_auth_id, target_role: 'volunteer', title: 'Shift Flagged / Denied', message: `Your shift has been flagged. Reason: ${cleanReason?.replace('_', ' ')}.`, type: 'shift_review_status', reference_id: id });
      } catch (err: any) { console.error(`Notification error on shift denial: ${err.message}`); }
    }

    return data;
  }

  async getShiftHistory(opts: { status?: string; volunteerName?: string; limit?: number }) {
    const client = this.db;
    let query = client.from('volunteer_shifts').select('id, clock_in, clock_out, status, total_hours, volunteer_auth_id, application_id').not('clock_out', 'is', null).order('clock_out', { ascending: false }).limit(opts.limit ?? 100);

    if (opts.status && opts.status !== 'all') {
      query = query.eq('status', opts.status);
    } else {
      query = query.in('status', ['approved', 'flagged', 'pending']);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return [];

    const authIds = [...new Set(data.map((d: any) => d.volunteer_auth_id).filter(Boolean))];
    const { data: profiles } = await client.from('user_profiles').select('auth_user_id, first_name, last_name').in('auth_user_id', authIds);
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.auth_user_id, p]));

    return data.map((shift: any) => {
      const p = profileMap.get(shift.volunteer_auth_id);
      const clockIn = shift.clock_in ? new Date(shift.clock_in) : null;
      const clockOut = shift.clock_out ? new Date(shift.clock_out) : null;
      const computedHours = clockIn && clockOut ? parseFloat(((clockOut.getTime() - clockIn.getTime()) / 3_600_000).toFixed(2)) : null;
      return { ...shift, volunteer_name: p ? `${p.first_name} ${p.last_name}` : 'Unknown Volunteer', computed_hours: computedHours };
    });
  }

  async editShift(id: string, dto: { status?: string; total_hours?: number; flag_reason?: string | null; notes?: string }) {
    const client = this.db;
    const { data: current, error: fetchErr } = await client.from('volunteer_shifts').select('*').eq('id', id).single();
    if (fetchErr || !current) throw new NotFoundException('Shift not found');

    const allowedStatuses = new Set(['approved', 'flagged', 'pending']);
    const newStatus = dto.status && allowedStatuses.has(dto.status) ? dto.status : undefined;
    const updatePayload: Record<string, any> = {};
    if (newStatus !== undefined) updatePayload.status = newStatus;
    if (dto.total_hours !== undefined) updatePayload.total_hours = dto.total_hours;
    if ('flag_reason' in dto) updatePayload.flag_reason = dto.flag_reason ?? null;
    if (dto.notes !== undefined) updatePayload.notes = dto.notes;
    if (newStatus === 'approved' || newStatus === 'pending') updatePayload.flag_reason = null;
    if (dto.total_hours === undefined && current.clock_in && current.clock_out) {
      const diffMs = new Date(current.clock_out).getTime() - new Date(current.clock_in).getTime();
      updatePayload.total_hours = parseFloat((diffMs / 3_600_000).toFixed(2));
    }

    const isSchemaMissing = (err: any) => /flag_reason|notes|schema cache|column .* does not exist/i.test(err?.message ?? err?.details ?? '');
    let updated: any, updateErr: any;

    ({ data: updated, error: updateErr } = await client.from('volunteer_shifts').update(updatePayload).eq('id', id).select().single());
    if (updateErr && isSchemaMissing(updateErr)) {
      const safePayload = { ...updatePayload };
      delete safePayload.flag_reason;
      delete safePayload.notes;
      ({ data: updated, error: updateErr } = await client.from('volunteer_shifts').update(safePayload).eq('id', id).select().single());
    }
    if (updateErr) throw updateErr;

    const wasApproved = current.status === 'approved';
    const isNowApproved = newStatus === 'approved';
    const hoursChanged = dto.total_hours !== undefined && dto.total_hours !== Number(current.total_hours);
    if (wasApproved || isNowApproved || hoursChanged) {
      const { data: profile } = await client.from('user_profiles').select('total_volunteer_hours').eq('auth_user_id', current.volunteer_auth_id).single();
      const currentTotal = Number(profile?.total_volunteer_hours ?? 0);
      const oldHours = wasApproved ? Number(current.total_hours ?? 0) : 0;
      const newHours = isNowApproved ? Number(updatePayload.total_hours ?? 0) : 0;
      const adjustedTotal = Math.max(0, currentTotal - oldHours + newHours);
      await client.from('user_profiles').update({ total_volunteer_hours: adjustedTotal }).eq('auth_user_id', current.volunteer_auth_id);
    }

    if (newStatus && newStatus !== current.status) {
      try {
        const statusLabel = newStatus === 'approved' ? 'Approved' : newStatus === 'flagged' ? 'Flagged' : 'Pending review';
        await client.from('bh_notifications').insert({ user_id: current.volunteer_auth_id, target_role: 'volunteer', title: 'Shift Status Updated', message: `Your shift record has been updated by the site manager. New status: ${statusLabel}.`, type: 'shift_review_status', reference_id: id });
      } catch (err: any) { console.error(`Notification error on shift edit: ${err.message}`); }
    }

    return updated;
  }
}
