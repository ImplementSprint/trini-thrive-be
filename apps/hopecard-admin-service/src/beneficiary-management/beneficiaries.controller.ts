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
import { RequirePersona } from '@app/common';

@RequirePersona('admin', 'hopecard')
@Controller('api/v1/hopecard/admin/beneficiaries')
export class BeneficiariesController {
  constructor(private readonly beneficiariesService: BeneficiariesService) {}

  @Get()

  async getAllBeneficiaries(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 10));
    return this.beneficiariesService.getAllBeneficiaries(pageNum, limitNum);
  }

  @Get('search')

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

    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 10));
    return this.beneficiariesService.searchBeneficiaries(
      query,
      pageNum,
      limitNum,
    );
  }

  @Get('status/:status')

  async getBeneficiariesByStatus(
    @Param('status') status: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 10));
    return this.beneficiariesService.getBeneficiariesByStatus(
      status,
      pageNum,
      limitNum,
    );
  }

  @Get(':id')

  async getBeneficiaryById(@Param('id') id: string) {
    return this.beneficiariesService.getBeneficiaryById(id);
  }

  @Post()

  @HttpCode(HttpStatus.CREATED)
  async createBeneficiary(@Body() beneficiaryData: any) {
    return this.beneficiariesService.createBeneficiary(beneficiaryData);
  }

  @Put(':id')

  async updateBeneficiary(
    @Param('id') id: string,
    @Body() updates: any,
  ) {
    return this.beneficiariesService.updateBeneficiary(id, updates);
  }

  @Delete(':id')

  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBeneficiary(@Param('id') id: string) {
    return this.beneficiariesService.deleteBeneficiary(id);
  }
}
