import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { AdminBranchService } from '../application/admin-branch.service';
import {
  AdminBranchQueryDto,
  CreateAdminBranchRoomDto,
  CreateBranchDto,
  UpdateBranchDto,
} from '../application/dto/req.dto';
import { BRANCH_MESSAGES } from '../domain/branch.rules';

const flatten = (errors: ValidationError[], parent = ''): string[] =>
  errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    return [
      ...Object.values(error.constraints ?? {}),
      ...flatten(error.children ?? [], path),
    ];
  });

const branchValidationPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  exceptionFactory: (errors) =>
    new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: BRANCH_MESSAGES.MSG02_REQUIRED,
      errors: flatten(errors),
      fields: errors.map((error) => error.property),
    }),
});

@Controller('branches')
@UsePipes(branchValidationPipe)
export class AdminBranchController {
  constructor(private readonly adminBranchService: AdminBranchService) {}

  @Get('admin')
  listAdminBranches(@Query() query: AdminBranchQueryDto) {
    return this.adminBranchService.listBranches(query);
  }

  @Get('admin/:branchId')
  getAdminBranchDetail(@Param('branchId') branchId: string) {
    return this.adminBranchService.getBranchDetail(branchId);
  }

  @Post('admin')
  createBranch(@Body() input: CreateBranchDto) {
    return this.adminBranchService.createBranch(input);
  }

  @Patch('admin/:branchId')
  updateBranch(
    @Param('branchId') branchId: string,
    @Body() input: UpdateBranchDto,
  ) {
    return this.adminBranchService.updateBranch(branchId, input);
  }

  @Delete('admin/:branchId')
  deactivateBranch(@Param('branchId') branchId: string) {
    return this.adminBranchService.deactivateBranch(branchId);
  }

  @Post('admin/:branchId/rooms')
  createRoomForBranch(
    @Param('branchId') branchId: string,
    @Body() input: CreateAdminBranchRoomDto,
  ) {
    return this.adminBranchService.createRoomForBranch(branchId, input);
  }

  @Get()
  listPublicBranches(@Query('search') search?: string) {
    return this.adminBranchService.listPublicBranches(search);
  }

  @Get(':branchId')
  getPublicBranchDetail(@Param('branchId') branchId: string) {
    return this.adminBranchService.getBranchDetail(branchId);
  }
}
