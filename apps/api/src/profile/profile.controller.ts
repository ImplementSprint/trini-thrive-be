import { Controller, Get, Patch, Query, Body } from '@nestjs/common';
import { ProfileService } from './profile.service';

@Controller()
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('profile')
  getProfile(@Query('authUserId') authUserId: string, @Query('email') email?: string) {
    return this.profileService.getProfile(authUserId, email);
  }

  @Patch('profile')
  updateProfile(@Body() body: any) {
    const { authUserId, ...updates } = body;
    return this.profileService.updateProfile(authUserId, updates);
  }

  @Get('impact')
  getImpact(@Query('authUserId') authUserId: string) {
    return this.profileService.getImpact(authUserId);
  }
}
