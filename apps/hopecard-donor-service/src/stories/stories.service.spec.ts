import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { StoriesService } from './stories.service';

const mockSupabaseRequest = jest.fn();
jest.mock('@app/common/supabase-helpers', () => ({
  supabaseRequest: (...args: any[]) => mockSupabaseRequest(...args),
}));

describe('StoriesService', () => {
  let service: StoriesService;

  beforeEach(async () => {
    mockSupabaseRequest.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [StoriesService],
    }).compile();
    service = module.get<StoriesService>(StoriesService);
  });

  describe('getStories', () => {
    it('returns stories when seeding is skipped (stories already exist)', async () => {
      const stories = [{ id: 's1', title: 'Story 1' }];
      mockSupabaseRequest
        .mockResolvedValueOnce([{ id: 'existing' }]) // seed check → already seeded, skip
        .mockResolvedValueOnce(stories); // final fetch
      const result = await service.getStories(10);
      expect(result.stories).toEqual(stories);
    });

    it('seeds all stories when DB is empty then returns fetch result', async () => {
      const stories = [{ id: 'maria-rebuild', title: 'How Maria...' }];
      // 1 check (empty) + 6 seed inserts + 1 final fetch = 8 calls
      mockSupabaseRequest
        .mockResolvedValueOnce([])  // check → empty
        .mockResolvedValueOnce({})  // seed 1
        .mockResolvedValueOnce({})  // seed 2
        .mockResolvedValueOnce({})  // seed 3
        .mockResolvedValueOnce({})  // seed 4
        .mockResolvedValueOnce({})  // seed 5
        .mockResolvedValueOnce({})  // seed 6
        .mockResolvedValueOnce(stories); // final fetch
      const result = await service.getStories();
      expect(result.stories).toEqual(stories);
    });

    it('throws HttpException when fetch fails', async () => {
      mockSupabaseRequest.mockRejectedValue(new Error('DB down'));
      await expect(service.getStories()).rejects.toBeInstanceOf(HttpException);
    });
  });

  describe('seedStories', () => {
    it('silently catches errors during seeding', async () => {
      mockSupabaseRequest.mockRejectedValue(new Error('Table missing'));
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      await expect(service.seedStories()).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('getStoryById', () => {
    it('returns story when found', async () => {
      const story = { id: 'maria-rebuild', title: 'How Maria...' };
      mockSupabaseRequest.mockResolvedValueOnce([story]);
      const result = await service.getStoryById('maria-rebuild');
      expect(result.story).toEqual(story);
    });

    it('throws 400 when storyId is empty', async () => {
      await expect(service.getStoryById('')).rejects.toBeInstanceOf(HttpException);
    });

    it('throws 404 when story not found', async () => {
      mockSupabaseRequest.mockResolvedValueOnce([]);
      await expect(service.getStoryById('missing')).rejects.toBeInstanceOf(HttpException);
    });

    it('re-throws HttpException as-is', async () => {
      mockSupabaseRequest.mockRejectedValue(new HttpException('Not found', 404));
      await expect(service.getStoryById('any')).rejects.toBeInstanceOf(HttpException);
    });

    it('wraps non-HttpException errors in 500', async () => {
      mockSupabaseRequest.mockRejectedValue(new Error('DB down'));
      await expect(service.getStoryById('any')).rejects.toMatchObject({ status: 500 });
    });
  });

  describe('getStoriesByCategory', () => {
    it('throws 400 when category is empty', async () => {
      await expect(service.getStoriesByCategory('')).rejects.toBeInstanceOf(HttpException);
    });

    it('returns stories for a category', async () => {
      const stories = [{ id: 's1', category: 'Health' }];
      mockSupabaseRequest.mockResolvedValueOnce(stories);
      const result = await service.getStoriesByCategory('Health');
      expect(result.stories).toEqual(stories);
    });

    it('wraps DB errors in HttpException', async () => {
      mockSupabaseRequest.mockRejectedValue(new Error('DB error'));
      await expect(service.getStoriesByCategory('Health')).rejects.toBeInstanceOf(HttpException);
    });
  });
});
