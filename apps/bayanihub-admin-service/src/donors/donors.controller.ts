import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePersona } from '@app/common';
import { DonorsService } from './donors.service';
import { CreateDonationDto, FilterDonorsDto, UpdateDonationDto } from './dto/donors.dto';

@RequirePersona('admin', 'bayanihub')
@Controller('donors')
export class DonorsController {
  constructor(private readonly donorsService: DonorsService) {}
  @Get() findAll(@Query() filters: FilterDonorsDto) { return this.donorsService.findAll(filters); }
  @Get(':id') findOne(@Param('id') id: string) { return this.donorsService.findOne(id); }
  @Post() create(@Body() dto: CreateDonationDto) { return this.donorsService.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateDonationDto) { return this.donorsService.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.donorsService.remove(id); }
}
