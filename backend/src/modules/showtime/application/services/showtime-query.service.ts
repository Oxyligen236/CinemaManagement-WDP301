import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, QueryFilter, Types } from 'mongoose';
import { Room, RoomDocument } from '../../../room/domain/schemas/room.schema';
import { Page } from '../../../../common/dto/page.dto';
import {
  Showtime,
  ShowtimeDocument,
} from '../../domain/schemas/showtime.schema';
import { SearchShowtimeReqDto } from '../dto/req.dto';
import { ShowtimeResDto } from '../dto/res.dto';
import { toShowtimeResDto } from '../helpers/showtime-res.mapper';
import { GetShowtimeDetailUsecase } from '../usecase/get-showtime-detail.usecase';
import { SearchShowtimesUsecase } from '../usecase/search-showtimes.usecase';

@Injectable()
export class ShowtimeQueryService
  implements SearchShowtimesUsecase, GetShowtimeDetailUsecase
{
  constructor(
    @InjectModel(Showtime.name)
    private readonly showtimeModel: Model<ShowtimeDocument>,
    @InjectModel(Room.name)
    private readonly roomModel: Model<RoomDocument>,
  ) {}

  /**
   * Kiểm tra xem phim có suất chiếu đang lên lịch hoặc đang diễn ra không.
   *
   * @param movieId - Mã định danh phim (string ObjectId)
   * @returns true nếu có ít nhất 1 suất chiếu có endTime >= now
   */
  async hasActiveShowtimes(movieId: string): Promise<boolean> {
    const movieFilter = isValidObjectId(movieId)
      ? { movieId: new Types.ObjectId(movieId) }
      : { movieId };
    const found = await this.showtimeModel.exists({
      ...movieFilter,
      endTime: { $gte: new Date() },
    });
    return found !== null;
  }

  async searchShowtimes(
    query: SearchShowtimeReqDto,
  ): Promise<Page<ShowtimeResDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const filter: QueryFilter<ShowtimeDocument> = {};

    if (query.movieId) {
      if (isValidObjectId(query.movieId)) {
        filter.movieId = new Types.ObjectId(query.movieId);
      } else {
        filter.movieId = query.movieId;
      }
    }
    if (query.branchId) {
      const branchQuery = isValidObjectId(query.branchId)
        ? { branchId: new Types.ObjectId(query.branchId) }
        : { branchId: query.branchId };
      const rooms = await this.roomModel
        .find(branchQuery)
        .select('_id')
        .lean()
        .exec();
      let roomIds = rooms.map((room) => room._id.toString());
      if (query.roomId) {
        roomIds = roomIds.filter((id) => id === query.roomId);
      }
      filter.roomId = {
        $in: roomIds.map((id) =>
          isValidObjectId(id) ? new Types.ObjectId(id) : id,
        ),
      };
    } else if (query.roomId) {
      filter.roomId = isValidObjectId(query.roomId)
        ? new Types.ObjectId(query.roomId)
        : query.roomId;
    }

    const startTime: { $gte?: Date; $lt?: Date; $lte?: Date } = {};
    if (query.date) {
      const start = new Date(query.date);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      startTime.$gte = start;
      startTime.$lt = end;
    }
    if (query.from) {
      const from = new Date(query.from);
      if (!startTime.$gte || from > startTime.$gte) startTime.$gte = from;
    }
    if (query.to) {
      const to = new Date(query.to);
      delete startTime.$lt;
      startTime.$lte = to;
    }
    if (Object.keys(startTime).length > 0) {
      filter.startTime = startTime;
    }

    const [docs, total] = await Promise.all([
      this.showtimeModel
        .find(filter)
        .sort({ startTime: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.showtimeModel.countDocuments(filter).exec(),
    ]);

    return Page.from(
      docs.map((doc) => this.toShowtimeResDto(doc)),
      total,
      page,
      limit,
    );
  }

  /**
   * Danh sách suất chiếu thuộc nhiều phòng, có lọc và phân trang (sắp xếp startTime tăng dần).
   *
   * @param roomIds - Các phòng được phép xem (rỗng -> trả Page rỗng, không truy vấn)
   * @param filter - Bộ lọc phim, phòng, khoảng startTime [from, to)
   * @param page - Trang hiện tại
   * @param limit - Số bản ghi mỗi trang
   * @returns Page<ShowtimeResDto>
   */
  async searchShowtimesByRooms(
    roomIds: string[],
    filter: { movieId?: string; roomId?: string; from?: Date; to?: Date },
    page: number,
    limit: number,
  ): Promise<Page<ShowtimeResDto>> {
    const scopedRoomIds = filter.roomId
      ? roomIds.filter((id) => id === filter.roomId)
      : roomIds;
    if (scopedRoomIds.length === 0) {
      return Page.from([], 0, page, limit);
    }

    const query: QueryFilter<ShowtimeDocument> = {
      roomId: {
        $in: scopedRoomIds.map((id) =>
          isValidObjectId(id) ? new Types.ObjectId(id) : id,
        ),
      },
    };
    if (filter.movieId) {
      query.movieId = isValidObjectId(filter.movieId)
        ? new Types.ObjectId(filter.movieId)
        : filter.movieId;
    }
    const startTime: { $gte?: Date; $lt?: Date } = {};
    if (filter.from) startTime.$gte = filter.from;
    if (filter.to) startTime.$lt = filter.to;
    if (Object.keys(startTime).length > 0) {
      query.startTime = startTime;
    }

    const [docs, total] = await Promise.all([
      this.showtimeModel
        .find(query)
        .sort({ startTime: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.showtimeModel.countDocuments(query).exec(),
    ]);
    return Page.from(
      docs.map((doc) => this.toShowtimeResDto(doc)),
      total,
      page,
      limit,
    );
  }

  async getShowtimeDetail(showtimeId: string): Promise<ShowtimeResDto> {
    const doc = isValidObjectId(showtimeId)
      ? await this.showtimeModel.findById(showtimeId).exec()
      : null;
    if (!doc) {
      throw new NotFoundException('Showtime not found');
    }
    return this.toShowtimeResDto(doc);
  }

  private toShowtimeResDto(doc: ShowtimeDocument): ShowtimeResDto {
    return toShowtimeResDto(doc);
  }
}
