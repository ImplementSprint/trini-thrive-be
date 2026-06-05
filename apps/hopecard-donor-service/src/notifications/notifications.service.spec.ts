import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';

const mockSupabaseRequest = jest.fn();
jest.mock('@app/common/supabase-helpers', () => ({
  supabaseRequest: (...args: any[]) => mockSupabaseRequest(...args),
}));

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    mockSupabaseRequest.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsService],
    }).compile();
    service = module.get<NotificationsService>(NotificationsService);
  });

  it('returns notifications for a donor', async () => {
    const rows = [{ id: 'n1', title: 'New Campaign', is_read: false }];
    mockSupabaseRequest.mockResolvedValueOnce(rows);
    const result = await service.getNotifications('donor-abc');
    expect(result.notifications).toEqual(rows);
    expect(mockSupabaseRequest).toHaveBeenCalledWith(
      expect.stringContaining('donor-abc'),
    );
  });

  it('marks a single notification as read', async () => {
    mockSupabaseRequest.mockResolvedValueOnce({});
    const result = await service.markRead('n1');
    expect(result).toEqual({ success: true });
    expect(mockSupabaseRequest).toHaveBeenCalledWith(
      expect.stringContaining('n1'),
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('marks all notifications as read for a donor', async () => {
    mockSupabaseRequest.mockResolvedValueOnce({});
    const result = await service.markAllRead('donor-abc');
    expect(result).toEqual({ success: true });
    expect(mockSupabaseRequest).toHaveBeenCalledWith(
      expect.stringContaining('donor-abc'),
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('creates a personal notification with metadata', async () => {
    mockSupabaseRequest.mockResolvedValueOnce({});
    await service.createNotification('donor-abc', 'new_campaign', 'Title', 'Msg', { campaignId: 'c1' });
    expect(mockSupabaseRequest).toHaveBeenCalledWith(
      'hc_donor_notifications',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"donor_auth_id":"donor-abc"'),
      }),
    );
  });

  it('creates a broadcast notification (null donorAuthId)', async () => {
    mockSupabaseRequest.mockResolvedValueOnce({});
    await service.createNotification(null, 'new_campaign', 'Title', 'Msg');
    expect(mockSupabaseRequest).toHaveBeenCalledWith(
      'hc_donor_notifications',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('broadcasts new campaign notification to all donors', async () => {
    const donors = [{ auth_user_id: 'd1' }, { auth_user_id: 'd2' }];
    mockSupabaseRequest.mockResolvedValueOnce(donors);
    mockSupabaseRequest.mockResolvedValueOnce({});
    await service.broadcastNewCampaign('c1', 'Help the Flood Victims');
    expect(mockSupabaseRequest).toHaveBeenCalledTimes(2);
    const insertCall = mockSupabaseRequest.mock.calls[1];
    const body = JSON.parse(insertCall[1].body);
    expect(body).toHaveLength(2);
    expect(body[0].donor_auth_id).toBe('d1');
  });

  it('skips insert when no donors exist', async () => {
    mockSupabaseRequest.mockResolvedValueOnce([]);
    await service.broadcastNewCampaign('c1', 'Help');
    expect(mockSupabaseRequest).toHaveBeenCalledTimes(1);
  });

  it('returns undefined gracefully when donor fetch throws', async () => {
    mockSupabaseRequest.mockRejectedValueOnce(new Error('DB error'));
    await expect(service.broadcastNewCampaign('c1', 'Help')).resolves.toBeUndefined();
  });
});
