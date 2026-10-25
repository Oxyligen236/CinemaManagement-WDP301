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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtGuard } from '../../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../../auth/infra/guards/role.guard';
import { Roles } from '../../../auth/infra/decorators/role.decorator';
import { AuthenticatedRequest, AuthUser } from '../../../auth/domain/auth-user';
import { Role } from '../../../user/domain/enums/role.enum';
import { StorageInterceptor } from '../../../infra/storage/infrastructure/interceptors/storage.interceptor';
import { StorageUpload } from '../../../infra/storage/infrastructure/decorators/storage-upload.decorator';
import { PresignedDowloadResponse } from '../../../infra/storage/dtos/dto';
import { ItemService } from '../../application/services/item.service';
import {
  AdjustItemStockReq,
  ChangeItemStatusReq,
  CreateItemReq,
  ImportItemsExcelReq,
  QueryBranchItemsReq,
  UpdateItemReq,
} from '../../application/dto/req.dto';

@Controller('manager/items')
@UseGuards(JwtGuard, RoleGuard)
@Roles(Role.BRANCHMANAGER)
export class ItemManagerController {
  constructor(private readonly itemService: ItemService) {}

  @Get('options')
  async getOptions(@Req() req: AuthenticatedRequest) {
    const user = req.user as AuthUser;
    return this.itemService.getConcessionOptions(user.sub);
  }

  @Get('excel-template')
  async getExcelTemplate(@Res() res: Response) {
    const buffer = await this.itemService.getItemExcelTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="concession-item-template.xlsx"',
    );
    res.send(buffer);
  }

  @Post('import-excel')
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ImportItemsExcelReq,
  ) {
    const user = req.user as AuthUser;
    return this.itemService.importItemsExcel(user.sub, file?.buffer, body);
  }

  @Get()
  async queryItems(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryBranchItemsReq,
  ) {
    const user = req.user as AuthUser;
    return this.itemService.queryBranchItems(user.sub, query);
  }

  @Get(':itemId')
  async getItemDetail(
    @Req() req: AuthenticatedRequest,
    @Param('itemId') itemId: string,
  ) {
    const user = req.user as AuthUser;
    return this.itemService.getItemDetail(user.sub, itemId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'), StorageInterceptor)
  @StorageUpload([{ field: 'file', path: 'concessions' }])
  async createItem(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateItemReq,
    @UploadedFile() file?: PresignedDowloadResponse,
  ) {
    const user = req.user as AuthUser;
    return this.itemService.createItem(user.sub, body, file?.key);
  }

  @Patch(':itemId')
  @UseInterceptors(FileInterceptor('file'), StorageInterceptor)
  @StorageUpload([{ field: 'file', path: 'concessions' }])
  async updateItem(
    @Req() req: AuthenticatedRequest,
    @Param('itemId') itemId: string,
    @Body() body: UpdateItemReq,
    @UploadedFile() file?: PresignedDowloadResponse,
  ) {
    const user = req.user as AuthUser;
    return this.itemService.updateItem(user.sub, itemId, body, file?.key);
  }

  @Patch(':itemId/stock')
  async adjustStock(
    @Req() req: AuthenticatedRequest,
    @Param('itemId') itemId: string,
    @Body() body: AdjustItemStockReq,
  ) {
    const user = req.user as AuthUser;
    return this.itemService.adjustItemStock(user.sub, itemId, body);
  }

  @Patch(':itemId/status')
  async changeStatus(
    @Req() req: AuthenticatedRequest,
    @Param('itemId') itemId: string,
    @Body() body: ChangeItemStatusReq,
  ) {
    const user = req.user as AuthUser;
    return this.itemService.changeItemStatus(user.sub, itemId, body);
  }

  @Delete(':itemId')
  async deleteItem(
    @Req() req: AuthenticatedRequest,
    @Param('itemId') itemId: string,
  ) {
    const user = req.user as AuthUser;
    return this.itemService.deleteItem(user.sub, itemId);
  }
}
