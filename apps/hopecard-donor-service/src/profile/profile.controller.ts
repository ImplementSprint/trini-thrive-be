import { Controller, Get, Patch, Query, Body, Req } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { RequirePersona } from '@app/common';

@RequirePersona('donor', 'hopecard')
@Controller('hopecard/donor')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('profile')
  getProfile(@Req() req: any, @Query('authUserId') authUserId?: string, @Query('email') email?: string) {
    const userId = authUserId || req.user?.sub;
    return this.profileService.getProfile(userId, email);
  }

  @Patch('profile')
  updateProfile(@Req() req: any, @Body() body: any) {
    const { authUserId, ...updates } = body;
    const userId = authUserId || req.user?.sub;
    return this.profileService.updateProfile(userId, updates);
  }

  @Get('impact')
  getImpact(@Req() req: any, @Query('authUserId') authUserId?: string) {
    const userId = authUserId || req.user?.sub;
    return this.profileService.getImpact(userId);
  }
}
