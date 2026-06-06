jest.mock('jose', () => ({ jwtVerify: jest.fn(), SignJWT: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';

const mockService = {
  getStories: jest.fn(),
  getStoriesByCategory: jest.fn(),
  getStoryById: jest.fn(),
};

describe('StoriesController', () => {
  let controller: StoriesController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StoriesController],
      providers: [{ provide: StoriesService, useValue: mockService }],
    }).compile();
    controller = module.get<StoriesController>(StoriesController);
  });

  it('getStories uses default limit of 50 when not provided', async () => {
    mockService.getStories.mockResolvedValue({ stories: [] });
    await controller.getStories(undefined);
    expect(mockService.getStories).toHaveBeenCalledWith(50);
  });

  it('getStories parses limit from string', async () => {
    mockService.getStories.mockResolvedValue({ stories: [] });
    await controller.getStories('10');
    expect(mockService.getStories).toHaveBeenCalledWith(10);
  });

  it('getStoriesByCategory uses default limit of 50 when not provided', async () => {
    mockService.getStoriesByCategory.mockResolvedValue({ stories: [] });
    await controller.getStoriesByCategory('Health', undefined);
    expect(mockService.getStoriesByCategory).toHaveBeenCalledWith('Health', 50);
  });

  it('getStoriesByCategory parses limit from string', async () => {
    mockService.getStoriesByCategory.mockResolvedValue({ stories: [] });
    await controller.getStoriesByCategory('Education', '5');
    expect(mockService.getStoriesByCategory).toHaveBeenCalledWith('Education', 5);
  });

  it('getStoryById delegates id param', async () => {
    mockService.getStoryById.mockResolvedValue({ story: { id: 'story-1' } });
    const result = await controller.getStoryById('story-1');
    expect(mockService.getStoryById).toHaveBeenCalledWith('story-1');
    expect(result).toEqual({ story: { id: 'story-1' } });
  });
});
