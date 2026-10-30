import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { Page } from '../../../../common/dto/page.dto';
import {
  STORAGE_SERVICE,
  type StorageService,
} from '../../../infra/storage/application/interface/storage.interface';
import { MovieStatus } from '../../domain/enums/movie-status.enum';
import { Movie, MovieDocument } from '../../domain/schemas/movie.schema';
import { MovieOptionResDto, MovieSchedulingInfoResDto } from '../dto/res.dto';
import { GetMovieSchedulingInfoUsecase } from '../usecase/get-movie-scheduling-info.usecase';
import { SearchMovieOptionsUsecase } from '../usecase/search-movie-options.usecase';

type MovieLean = {
  _id: Types.ObjectId | string;
  movieName: string;
  duration: number;
  status: string;
  isActive: boolean;
  posterKey?: string;
};

@Injectable()
export class MovieOptionQueryService
  implements SearchMovieOptionsUsecase, GetMovieSchedulingInfoUsecase
{
  constructor(
    @InjectModel(Movie.name) private readonly movieModel: Model<MovieDocument>,
    @Inject(STORAGE_SERVICE) private readonly storageService: StorageService,
  ) {}

  async searchMovieOptions(
    keyword: string | undefined,
    page: number,
    limit: number,
  ): Promise<Page<MovieOptionResDto>> {
    const filter: QueryFilter<MovieDocument> = {
      isActive: true,
      status: { $ne: MovieStatus.ENDED },
    };

    const trimmed = keyword?.trim();
    if (trimmed) {
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.movieName = { $regex: escaped, $options: 'i' };
    }

    const [docs, total] = await Promise.all([
      this.movieModel
        .find(filter)
        .sort({ movieName: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.movieModel.countDocuments(filter).exec(),
    ]);

    const items = (docs as unknown as MovieLean[]).map((doc) =>
      this.toOption(doc),
    );
    return Page.from(items, total, page, limit);
  }

  async getMovieSchedulingInfo(
    movieId: string,
  ): Promise<MovieSchedulingInfoResDto | null> {
    const doc = (await this.movieModel
      .findById(movieId)
      .lean()
      .exec()) as unknown as MovieLean | null;
    return doc ? this.toSchedulingInfo(doc) : null;
  }

  async getMovieSchedulingInfos(
    movieIds: string[],
  ): Promise<MovieSchedulingInfoResDto[]> {
    if (movieIds.length === 0) {
      return [];
    }
    const docs = (await this.movieModel
      .find({ _id: { $in: movieIds } })
      .lean()
      .exec()) as unknown as MovieLean[];
    return docs.map((doc) => this.toSchedulingInfo(doc));
  }

  private resolvePosterUrl(doc: MovieLean): string | undefined {
    if (!doc.posterKey) {
      return undefined;
    }
    try {
      return this.storageService.getPublicUrl(doc.posterKey);
    } catch {
      return undefined;
    }
  }

  private toOption(doc: MovieLean): MovieOptionResDto {
    return MovieOptionResDto.from({
      movieId: doc._id.toString(),
      movieName: doc.movieName,
      duration: doc.duration,
      status: doc.status,
      posterUrl: this.resolvePosterUrl(doc),
    });
  }

  private toSchedulingInfo(doc: MovieLean): MovieSchedulingInfoResDto {
    return MovieSchedulingInfoResDto.from({
      movieId: doc._id.toString(),
      movieName: doc.movieName,
      duration: doc.duration,
      status: doc.status,
      isActive: doc.isActive,
      posterUrl: this.resolvePosterUrl(doc),
    });
  }
}
