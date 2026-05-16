import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BeneficiariesService } from './beneficiaries.service';
import { Protected } from '@shared/protected.decorator';

@Controller('beneficiaries')
export class BeneficiariesController {
  constructor(private beneficiariesService: BeneficiariesService) {}

  @Get()
  @Protected()
  async getAllBeneficiaries(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    return this.beneficiariesService.getAllBeneficiaries(pageNum, limitNum);
  }

  @Get('search')
  @Protected()
  async searchBeneficiaries(
    @Query('q') query: string = '',
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    if (!query || query.trim().length === 0) {
      return {
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        message: 'Please provide a search query',
      };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    return this.beneficiariesService.searchBeneficiaries(
      query,
      pageNum,
      limitNum,
    );
  }

  @Get('status/:status')
  @Protected()
  async getBeneficiariesByStatus(
    @Param('status') status: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    return this.beneficiariesService.getBeneficiariesByStatus(
      status,
      pageNum,
      limitNum,
    );
  }

  @Get(':id')
  @Protected()
  async getBeneficiaryById(@Param('id') id: string) {
    return this.beneficiariesService.getBeneficiaryById(id);
  }

  @Post()
  @Protected()
  @HttpCode(HttpStatus.CREATED)
  async createBeneficiary(@Body() beneficiaryData: any) {
    return this.beneficiariesService.createBeneficiary(beneficiaryData);
  }

  @Put(':id')
  @Protected()
  async updateBeneficiary(
    @Param('id') id: string,
    @Body() updates: any,
  ) {
    return this.beneficiariesService.updateBeneficiary(id, updates);
  }

  @Delete(':id')
  @Protected()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBeneficiary(@Param('id') id: string) {
    return this.beneficiariesService.deleteBeneficiary(id);
  }
}
