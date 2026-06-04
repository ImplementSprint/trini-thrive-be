import { Controller, Get, Param, Query } from '@nestjs/common';
import { StoriesService } from './stories.service';
import { RequirePersona } from '@app/common';

@RequirePersona('donor', 'hopecard')
@Controller('api/v1/hopecard/donor/stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Get()
  getStories(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.storiesService.getStories(parsedLimit);
  }

  @Get('by-category')
  getStoriesByCategory(@Query('category') category: string, @Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.storiesService.getStoriesByCategory(category, parsedLimit);
  }

  @Get(':id')
  getStoryById(@Param('id') id: string) {
    return this.storiesService.getStoryById(id);
  }
}
