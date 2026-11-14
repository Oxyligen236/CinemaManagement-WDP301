import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Page } from '../../../../common/dto/page.dto';
import { AuthenticatedRequest } from '../../../auth/domain/auth-user';
import { JwtGuard } from '../../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../../auth/infra/guards/role.guard';
import { PresignedDowloadResponse } from '../../../infra/storage/dtos/dto';
import { StorageInterceptor } from '../../../infra/storage/infrastructure/interceptors/storage.interceptor';
import { Role } from '../../../user/domain/enums/role.enum';
import {
  CreateComboReq,
  QueryBranchCombosReq,
  UpdateComboReq,
} from '../../application/dto/req.dto';
import {
  ComboMutationRes,
  ComboRes,
  DeleteMutationRes,
} from '../../application/dto/res.dto';
import { ComboService } from '../../application/services/combo.service';
import { ComboStatus } from '../../domain/enums/combo-status.enum';
import { ComboManagerController } from './combo-manager.controller';

describe('ComboManagerController', () => {
  let controller: ComboManagerController;
  let comboService: jest.Mocked<
    Pick<
      ComboService,
      | 'queryBranchCombos'
      | 'getComboDetail'
      | 'createCombo'
      | 'updateCombo'
      | 'changeComboStatus'
      | 'deleteCombo'
    >
  >;

  const mockReq = {
    user: {
      sub: 'mgr-1',
      email: 'mgr@example.com',
      role: Role.BRANCHMANAGER,
      tokenVersion: 0,
    },
  } as AuthenticatedRequest;

  beforeEach(async () => {
    comboService = {
      queryBranchCombos: jest.fn(),
      getComboDetail: jest.fn(),
      createCombo: jest.fn(),
      updateCombo: jest.fn(),
      changeComboStatus: jest.fn(),
      deleteCombo: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ComboManagerController],
      providers: [{ provide: ComboService, useValue: comboService }],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RoleGuard)
      .useValue({ canActivate: () => true })
      .overrideInterceptor(StorageInterceptor)
      .useValue({
        intercept: (_ctx: ExecutionContext, next: CallHandler) => next.handle(),
      })
      .compile();

    controller = module.get<ComboManagerController>(ComboManagerController);
  });

  it('queryCombos delegates to comboService.queryBranchCombos', async () => {
    const query = Object.assign(new QueryBranchCombosReq(), {
      page: 1,
      limit: 10,
      search: 'Solo',
    });
    const expected = Page.from<ComboRes>([], 0, 1, 10);
    comboService.queryBranchCombos.mockResolvedValue(expected);

    const res = await controller.queryCombos(mockReq, query);
    expect(comboService.queryBranchCombos).toHaveBeenCalledWith('mgr-1', query);
    expect(res).toBe(expected);
  });

  it('getComboDetail delegates to comboService.getComboDetail', async () => {
    const expected = { comboId: 'combo-1', name: 'Solo' } as ComboRes;
    comboService.getComboDetail.mockResolvedValue(expected);

    const res = await controller.getComboDetail(mockReq, 'combo-1');
    expect(comboService.getComboDetail).toHaveBeenCalledWith(
      'mgr-1',
      'combo-1',
    );
    expect(res).toBe(expected);
  });

  it('createCombo passes file.key when file uploaded and undefined otherwise', async () => {
    const body = { name: 'Combo 1', price: 70000, items: [] } as CreateComboReq;
    const expected: ComboMutationRes = {
      message: 'OK',
      combo: { comboId: 'c-1' } as ComboRes,
    };
    comboService.createCombo.mockResolvedValue(expected);

    const resWithFile = await controller.createCombo(mockReq, body, {
      key: 'concessions/c1.png',
    } as PresignedDowloadResponse);
    expect(comboService.createCombo).toHaveBeenCalledWith(
      'mgr-1',
      body,
      'concessions/c1.png',
    );
    expect(resWithFile).toBe(expected);

    await controller.createCombo(mockReq, body, undefined);
    expect(comboService.createCombo).toHaveBeenCalledWith(
      'mgr-1',
      body,
      undefined,
    );
  });

  it('updateCombo passes file.key when file uploaded and undefined otherwise', async () => {
    const body = { price: 80000 } as UpdateComboReq;
    const expected: ComboMutationRes = {
      message: 'Updated',
      combo: { comboId: 'c-1' } as ComboRes,
    };
    comboService.updateCombo.mockResolvedValue(expected);

    const resWithFile = await controller.updateCombo(mockReq, 'c-1', body, {
      key: 'concessions/c2.png',
    } as PresignedDowloadResponse);
    expect(comboService.updateCombo).toHaveBeenCalledWith(
      'mgr-1',
      'c-1',
      body,
      'concessions/c2.png',
    );
    expect(resWithFile).toBe(expected);

    await controller.updateCombo(mockReq, 'c-1', body, undefined);
    expect(comboService.updateCombo).toHaveBeenCalledWith(
      'mgr-1',
      'c-1',
      body,
      undefined,
    );
  });

  it('changeStatus delegates to comboService.changeComboStatus', async () => {
    const body = { status: ComboStatus.INACTIVE };
    const expected = { message: 'Updated' } as ComboMutationRes;
    comboService.changeComboStatus.mockResolvedValue(expected);

    const res = await controller.changeStatus(mockReq, 'c-1', body);
    expect(comboService.changeComboStatus).toHaveBeenCalledWith(
      'mgr-1',
      'c-1',
      body,
    );
    expect(res).toBe(expected);
  });

  it('deleteCombo delegates to comboService.deleteCombo', async () => {
    const expected: DeleteMutationRes = { message: 'Deleted', id: 'c-1' };
    comboService.deleteCombo.mockResolvedValue(expected);

    const res = await controller.deleteCombo(mockReq, 'c-1');
    expect(comboService.deleteCombo).toHaveBeenCalledWith('mgr-1', 'c-1');
    expect(res).toBe(expected);
  });
});
