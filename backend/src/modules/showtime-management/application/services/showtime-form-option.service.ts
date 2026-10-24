import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Page } from '../../../../common/dto/page.dto';
import { BranchQueryService } from '../../../branch/application/services/branch-query.service';
import type { MovieOptionResDto } from '../../../movie/application/dto/res.dto';
import { MovieOptionQueryService } from '../../../movie/application/services/movie-option-query.service';
import type { RoomOptionResDto } from '../../../room/application/dto/res.dto';
import { RoomOptionQueryService } from '../../../room/application/services/room-option-query.service';
import { UserBranchQueryService } from '../../../user/application/services/user-branch-query.service';
import {
  MSG_LOAD_FAILED,
  MSG_NO_BRANCH,
} from '../../domain/constants/showtime-management.constants';
import { MovieOptionSearchReqDto } from '../dto/req.dto';
import { ManagerContextResDto } from '../dto/res.dto';
import {
  requireBranchId,
  toHttpError,
} from '../helpers/showtime-management-validation.helper';
import { GetManagerContextUsecase } from '../usecase/get-manager-context.usecase';
import { ListShowtimeFormOptionsUsecase } from '../usecase/list-showtime-form-options.usecase';

@Injectable()
export class ShowtimeFormOptionService
  implements GetManagerContextUsecase, ListShowtimeFormOptionsUsecase
{
  private readonly logger = new Logger(ShowtimeFormOptionService.name);

  constructor(
    private readonly userBranchQuery: UserBranchQueryService,
    private readonly branchQuery: BranchQueryService,
    private readonly movieOptionQuery: MovieOptionQueryService,
    private readonly roomOptionQuery: RoomOptionQueryService,
  ) {}

  async getManagerContext(userId: string): Promise<ManagerContextResDto> {
    try {
      const branchId = await requireBranchId(this.userBranchQuery, userId);
      const branch = await this.branchQuery.getBranchSummary(branchId);
      if (!branch) throw new ForbiddenException(MSG_NO_BRANCH);
      return { branchId: branch.branchId, branchName: branch.branchName };
    } catch (error) {
      throw toHttpError(this.logger, error, MSG_LOAD_FAILED);
    }
  }

  async searchMovieOptions(
    userId: string,
    query: MovieOptionSearchReqDto,
  ): Promise<Page<MovieOptionResDto>> {
    try {
      await requireBranchId(this.userBranchQuery, userId);
      return await this.movieOptionQuery.searchMovieOptions(
        query.keyword,
        query.page ?? 1,
        query.limit ?? 10,
      );
    } catch (error) {
      throw toHttpError(this.logger, error, MSG_LOAD_FAILED);
    }
  }

  async listRoomOptions(userId: string): Promise<RoomOptionResDto[]> {
    try {
      const branchId = await requireBranchId(this.userBranchQuery, userId);
      return await this.roomOptionQuery.listRoomsByBranch(branchId);
    } catch (error) {
      throw toHttpError(this.logger, error, MSG_LOAD_FAILED);
    }
  }
}
