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
  UseGuards,
  UsePipes,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { JwtGuard } from '../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../auth/infra/guards/role.guard';
import { Roles } from '../../auth/infra/decorators/role.decorator';
import { Role } from '../../user/domain/enums/role.enum';
import { AdminBranchService } from '../application/admin-branch.service';
import { BranchQueryService } from '../application/services/branch-query.service';
import {
  AdminBranchQueryDto,
  CreateBranchDto,
  GetPublicBranchesReqDto,
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
  constructor(
    private readonly adminBranchService: AdminBranchService,
    private readonly branchQueryService: BranchQueryService,
  ) {}

  @Get('admin')
  @UseGuards(JwtGuard, RoleGuard)
  @Roles(Role.ADMIN)
  listAdminBranches(@Query() query: AdminBranchQueryDto) {
    return this.adminBranchService.listBranches(query);
  }

  @Get('admin/:branchId')
  @UseGuards(JwtGuard, RoleGuard)
  @Roles(Role.ADMIN)
  getAdminBranchDetail(@Param('branchId') branchId: string) {
    return this.adminBranchService.getBranchDetail(branchId);
  }

  @Post('admin')
  @UseGuards(JwtGuard, RoleGuard)
  @Roles(Role.ADMIN)
  createBranch(@Body() input: CreateBranchDto) {
    return this.adminBranchService.createBranch(input);
  }

  @Patch('admin/:branchId')
  @UseGuards(JwtGuard, RoleGuard)
  @Roles(Role.ADMIN)
  updateBranch(
    @Param('branchId') branchId: string,
    @Body() input: UpdateBranchDto,
  ) {
    return this.adminBranchService.updateBranch(branchId, input);
  }

  @Delete('admin/:branchId')
  @UseGuards(JwtGuard, RoleGuard)
  @Roles(Role.ADMIN)
  deactivateBranch(@Param('branchId') branchId: string) {
    return this.adminBranchService.deactivateBranch(branchId);
  }

  @Get('public')
  listPublicBranchesCompact(@Query() query: GetPublicBranchesReqDto) {
    return this.branchQueryService.getPublicBranches(query);
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
