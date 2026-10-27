import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model } from 'mongoose';
import { Page } from '../../../../common/dto/page.dto';
import {
  STORAGE_SERVICE,
  type StorageService,
} from '../../../infra/storage/application/interface/storage.interface';
import { ShowtimeQueryService } from '../../../showtime/application/services/showtime-query.service';
import {
  MSG08,
  MSG09,
  MSG10,
  MSG_FILE_REQUIRED,
  MSG_INVALID_POSTER_KEY,
  POSTER_ALLOWED_MIME_TYPES,
  POSTER_MAX_SIZE,
  POSTER_PREFIX,
} from '../../domain/constants/movie-asset.constants';
import { Genre, GenreDocument } from '../../domain/schemas/genre.schema';
import { Movie, MovieDocument } from '../../domain/schemas/movie.schema';
import { CreateMovieReqDto, SearchMovieReqDto } from '../dto/req.dto';
import {
  GenreItemResDto,
  GenreResDto,
  MovieDetailResDto,
  MovieResDto,
  UploadMovieAssetResDto,
} from '../dto/res.dto';
import { sanitizeFileName } from '../helpers/sanitize-file-name.helper';
import { CreateMovieUsecase } from '../usecase/create-movie.usecase';
import { DeactivateMovieUsecase } from '../usecase/deactivate-movie.usecase';
import { GetGenresUsecase } from '../usecase/get-genres.usecase';
import { GetMovieDetailUsecase } from '../usecase/get-movie-detail.usecase';
import { SearchMoviesUsecase } from '../usecase/search-movies.usecase';
import { UploadMovieAssetUsecase } from '../usecase/upload-movie-asset.usecase';

@Injectable()
export class MovieService
  implements
    CreateMovieUsecase,
    SearchMoviesUsecase,
    DeactivateMovieUsecase,
    GetGenresUsecase,
    UploadMovieAssetUsecase,
    GetMovieDetailUsecase
{
  constructor(
    @InjectModel(Movie.name) private readonly movieModel: Model<MovieDocument>,
    @InjectModel(Genre.name) private readonly genreModel: Model<GenreDocument>,
    private readonly showtimeQueryService: ShowtimeQueryService,
    @Inject(STORAGE_SERVICE) private readonly storageService: StorageService,
  ) {}

  async uploadAsset(
    file: Express.Multer.File,
  ): Promise<UploadMovieAssetResDto> {
    if (!file?.buffer) {
      throw new BadRequestException(MSG_FILE_REQUIRED);
    }
    if (!POSTER_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(MSG08);
    }
    const size = file.size ?? file.buffer.length;
    if (size > POSTER_MAX_SIZE) {
      throw new BadRequestException(MSG09);
    }

    const key = `${POSTER_PREFIX}/${randomUUID()}-${sanitizeFileName(file.originalname)}`;
    try {
      await this.storageService.upload({
        key,
        body: file.buffer,
        originalName: file.originalname,
        contentType: file.mimetype,
        contentLength: size,
      });
    } catch {
      throw new InternalServerErrorException(MSG10);
    }
    return {
      storageKey: key,
      url: this.storageService.getPublicUrl(key),
      originalName: file.originalname,
      size,
      contentType: file.mimetype,
    };
  }

  async createMovie(dto: CreateMovieReqDto): Promise<MovieResDto> {
    const posterExists = await this.storageService.exists(dto.posterKey);
    if (!posterExists) {
      throw new BadRequestException(MSG_INVALID_POSTER_KEY);
    }

    const created = await this.movieModel.create({
      movieName: dto.movieName,
      duration: dto.duration,
      genreIds: dto.genreIds,
      description: dto.description,
      posterKey: dto.posterKey,
      trailerUrl: dto.trailerUrl,
      releaseDate: dto.releaseDate ? new Date(dto.releaseDate) : undefined,
      status: dto.status,
      isActive: true,
    });
    return this.toMovieResDto(created);
  }

  async searchMovies(query: SearchMovieReqDto): Promise<Page<MovieResDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const filter: QueryFilter<MovieDocument> = {};

    const keyword = query.keyword?.trim();
    if (keyword) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.movieName = { $regex: escaped, $options: 'i' };
    }
    if (query.genreId) {
      filter.genreIds = query.genreId;
    }
    if (query.status) {
      filter.status = query.status;
    }
    if (query.releaseDate) {
      const start = new Date(query.releaseDate);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      filter.releaseDate = { $gte: start, $lt: end };
    }

    const [docs, total] = await Promise.all([
      this.movieModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.movieModel.countDocuments(filter).exec(),
    ]);

    return Page.from(
      docs.map((doc) => this.toMovieResDto(doc)),
      total,
      page,
      limit,
    );
  }

  async deactivateMovie(movieId: string): Promise<MovieResDto> {
    const movie = await this.movieModel.findOne({ movieId }).exec();
    if (!movie) {
      throw new NotFoundException('Movie not found.');
    }

    const hasActive =
      await this.showtimeQueryService.hasActiveShowtimes(movieId);
    if (hasActive) {
      throw new ConflictException(
        'Cannot deactivate film with scheduled or ongoing showtimes.',
      );
    }

    movie.isActive = false;
    await movie.save();
    return this.toMovieResDto(movie);
  }

  async getGenres(): Promise<GenreResDto[]> {
    const genres = await this.genreModel.find().sort({ genreName: 1 }).exec();
    return genres.map((genre) => ({
      genreId: genre.genreId,
      genreName: genre.genreName,
      genreDescription: genre.genreDescription,
    }));
  }

  async getMovieDetail(movieId: string): Promise<MovieDetailResDto> {
    const movie = await this.movieModel
      .findOne({ movieId, isActive: true })
      .lean()
      .exec();
    if (!movie) {
      throw new NotFoundException(
        `Không tìm thấy phim với mã định danh: ${movieId}`,
      );
    }

    let genres: GenreItemResDto[] = [];
    if (movie.genreIds && movie.genreIds.length > 0) {
      const genreDocs = await this.genreModel
        .find({ genreId: { $in: movie.genreIds } })
        .select('genreId genreName')
        .lean()
        .exec();
      genres = genreDocs.map((g) => ({
        genreId: g.genreId,
        genreName: g.genreName,
      }));
    }

    return {
      movieId: movie.movieId,
      movieName: movie.movieName,
      duration: movie.duration,
      status: movie.status,
      posterUrl: this.resolvePosterUrl(movie),
      trailerUrl: movie.trailerUrl,
      description: movie.description,
      releaseDate: movie.releaseDate
        ? new Date(movie.releaseDate).toISOString()
        : undefined,
      isActive: movie.isActive,
      genreIds: movie.genreIds,
      genres,
      createdAt: (movie as any).createdAt,
      updatedAt: (movie as any).updatedAt,
    };
  }

  private resolvePosterUrl(doc: { posterKey?: string }): string | undefined {
    if (!doc.posterKey) {
      return undefined;
    }
    try {
      return this.storageService.getPublicUrl(doc.posterKey);
    } catch {
      return undefined;
    }
  }

  private toMovieResDto(doc: MovieDocument): MovieResDto {
    const timestamps = doc as MovieDocument & {
      createdAt: Date;
      updatedAt: Date;
    };
    return {
      movieId: doc.movieId,
      movieName: doc.movieName,
      duration: doc.duration,
      status: doc.status,
      posterKey: doc.posterKey,
      posterUrl: this.resolvePosterUrl(doc),
      trailerUrl: doc.trailerUrl,
      description: doc.description,
      releaseDate: doc.releaseDate?.toISOString(),
      isActive: doc.isActive,
      genreIds: doc.genreIds,
      createdAt: timestamps.createdAt,
      updatedAt: timestamps.updatedAt,
    };
  }
}
