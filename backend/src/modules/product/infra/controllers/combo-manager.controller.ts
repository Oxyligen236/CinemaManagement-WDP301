import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtGuard } from '../../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../../auth/infra/guards/role.guard';
import { Roles } from '../../../auth/infra/decorators/role.decorator';
import { AuthenticatedRequest, AuthUser } from '../../../auth/domain/auth-user';
import { Role } from '../../../user/domain/enums/role.enum';
import { StorageInterceptor } from '../../../infra/storage/infrastructure/interceptors/storage.interceptor';
import { StorageUpload } from '../../../infra/storage/infrastructure/decorators/storage-upload.decorator';
import { PresignedDowloadResponse } from '../../../infra/storage/dtos/dto';
import { ComboService } from '../../application/services/combo.service';
import {
  ChangeComboStatusReq,
  CreateComboReq,
  QueryBranchCombosReq,
  UpdateComboReq,
} from '../../application/dto/req.dto';

@Controller('manager/combos')
@UseGuards(JwtGuard, RoleGuard)
@Roles(Role.BRANCHMANAGER)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ComboManagerController {
  constructor(private readonly comboService: ComboService) {}

  @Get()
  async queryCombos(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryBranchCombosReq,
  ) {
    const user = req.user as AuthUser;
    return this.comboService.queryBranchCombos(user.sub, query);
  }

  @Get(':comboId')
  async getComboDetail(
    @Req() req: AuthenticatedRequest,
    @Param('comboId') comboId: string,
  ) {
    const user = req.user as AuthUser;
    return this.comboService.getComboDetail(user.sub, comboId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'), StorageInterceptor)
  @StorageUpload([{ field: 'file', path: 'concessions' }])
  async createCombo(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateComboReq,
    @UploadedFile() file?: PresignedDowloadResponse,
  ) {
    const user = req.user as AuthUser;
    return this.comboService.createCombo(user.sub, body, file?.key);
  }

  @Patch(':comboId')
  @UseInterceptors(FileInterceptor('file'), StorageInterceptor)
  @StorageUpload([{ field: 'file', path: 'concessions' }])
  async updateCombo(
    @Req() req: AuthenticatedRequest,
    @Param('comboId') comboId: string,
    @Body() body: UpdateComboReq,
    @UploadedFile() file?: PresignedDowloadResponse,
  ) {
    const user = req.user as AuthUser;
    return this.comboService.updateCombo(user.sub, comboId, body, file?.key);
  }

  @Patch(':comboId/status')
  async changeStatus(
    @Req() req: AuthenticatedRequest,
    @Param('comboId') comboId: string,
    @Body() body: ChangeComboStatusReq,
  ) {
    const user = req.user as AuthUser;
    return this.comboService.changeComboStatus(user.sub, comboId, body);
  }

  @Delete(':comboId')
  async deleteCombo(
    @Req() req: AuthenticatedRequest,
    @Param('comboId') comboId: string,
  ) {
    const user = req.user as AuthUser;
    return this.comboService.deleteCombo(user.sub, comboId);
  }
}
