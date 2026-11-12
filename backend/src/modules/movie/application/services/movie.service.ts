import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  Movie,
  MovieStatus as PrismaMovieStatus,
  Prisma,
} from '@prisma/client';
import { Page } from '../../../../common/dto/page.dto';
import { PrismaService } from '../../../infra/prisma/prisma.service';
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
import { MovieStatus } from '../../domain/enums/movie-status.enum';
import { CreateMovieReqDto, SearchMovieReqDto } from '../dto/req.dto';
import {
  GenreItemResDto,
  GenreResDto,
  MovieDetailResDto,
  MovieResDto,
  MovieSummaryResDto,
  UploadMovieAssetResDto,
} from '../dto/res.dto';
import { sanitizeFileName } from '../helpers/sanitize-file-name.helper';

@Injectable()
export class MovieService {
  constructor(
    private readonly prisma: PrismaService,
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
    return UploadMovieAssetResDto.of(
      key,
      this.storageService.getPublicUrl(key),
      file.originalname,
      size,
      file.mimetype,
    );
  }

  async createMovie(dto: CreateMovieReqDto): Promise<MovieResDto> {
    const posterExists = await this.storageService.exists(dto.posterKey);
    if (!posterExists) {
      throw new BadRequestException(MSG_INVALID_POSTER_KEY);
    }

    const created = await this.prisma.movie.create({
      data: {
        movieName: dto.movieName,
        duration: dto.duration,
        genreIds: dto.genreIds,
        description: dto.description,
        posterKey: dto.posterKey,
        trailerUrl: dto.trailerUrl,
        releaseDate: dto.releaseDate ? new Date(dto.releaseDate) : undefined,
        status: dto.status as unknown as PrismaMovieStatus,
        isActive: true,
      },
    });
    return this.toMovieResDto(created);
  }

  async searchMovies(query: SearchMovieReqDto): Promise<Page<MovieResDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.MovieWhereInput = {};

    const keyword = query.keyword?.trim();
    if (keyword) {
      where.movieName = { contains: keyword, mode: 'insensitive' };
    }
    if (query.genreId) {
      where.genreIds = { has: query.genreId };
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.releaseDate) {
      const start = new Date(query.releaseDate);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      where.releaseDate = { gte: start, lt: end };
    }

    const [docs, total] = await Promise.all([
      this.prisma.movie.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.movie.count({ where }),
    ]);

    return Page.from(
      docs.map((doc) => this.toMovieResDto(doc)),
      total,
      page,
      limit,
    );
  }

  async deactivateMovie(movieId: string): Promise<MovieResDto> {
    const movie = await this.prisma.movie.findUnique({
      where: { id: movieId },
    });
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

    const updated = await this.prisma.movie.update({
      where: { id: movieId },
      data: { isActive: false },
    });
    return this.toMovieResDto(updated);
  }

  async getGenres(): Promise<GenreResDto[]> {
    const genres = await this.prisma.genre.findMany({
      orderBy: { genreName: 'asc' },
    });
    return genres.map((genre) =>
      GenreResDto.of(
        genre.id,
        genre.genreName,
        genre.genreDescription ?? undefined,
      ),
    );
  }

  async getMovieDetail(movieId: string): Promise<MovieDetailResDto> {
    const movie = await this.prisma.movie.findFirst({
      where: { id: movieId, isActive: true },
    });
    if (!movie) {
      throw new NotFoundException(
        `Không tìm thấy phim với mã định danh: ${movieId}`,
      );
    }

    let genres: GenreItemResDto[] = [];
    if (movie.genreIds && movie.genreIds.length > 0) {
      const genreDocs = await this.prisma.genre.findMany({
        where: { id: { in: movie.genreIds } },
        select: { id: true, genreName: true },
      });
      genres = genreDocs.map((g) => GenreItemResDto.of(g.id, g.genreName));
    }

    return MovieDetailResDto.of({
      movieId: movie.id,
      movieName: movie.movieName,
      duration: movie.duration,
      status: movie.status as unknown as MovieStatus,
      posterUrl: this.resolvePosterUrl(movie),
      trailerUrl: movie.trailerUrl ?? undefined,
      description: movie.description ?? undefined,
      releaseDate: movie.releaseDate
        ? new Date(movie.releaseDate).toISOString()
        : undefined,
      isActive: movie.isActive,
      genreIds: movie.genreIds,
      genres,
      createdAt: movie.createdAt,
      updatedAt: movie.updatedAt,
    });
  }

  async getMovieSummary(movieId: string): Promise<MovieSummaryResDto | null> {
    const movie = await this.prisma.movie.findUnique({
      where: { id: movieId },
    });
    if (!movie) {
      return null;
    }
    return this.toSummary(movie);
  }

  async getMoviesSummary(movieIds: string[]): Promise<MovieSummaryResDto[]> {
    if (!movieIds || movieIds.length === 0) {
      return [];
    }
    const movies = await this.prisma.movie.findMany({
      where: { id: { in: movieIds } },
    });
    return movies.map((movie) => this.toSummary(movie));
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

  private toSummary(movie: Movie): MovieSummaryResDto {
    return MovieSummaryResDto.of(
      movie.id,
      movie.movieName,
      movie.duration,
      movie.status,
      this.resolvePosterUrl(movie),
      movie.releaseDate ? new Date(movie.releaseDate) : undefined,
    );
  }

  private toMovieResDto(doc: Movie): MovieResDto {
    return MovieResDto.of({
      movieId: doc.id,
      movieName: doc.movieName,
      duration: doc.duration,
      status: doc.status as unknown as MovieStatus,
      posterKey: doc.posterKey,
      posterUrl: this.resolvePosterUrl(doc),
      trailerUrl: doc.trailerUrl ?? undefined,
      description: doc.description ?? undefined,
      releaseDate: doc.releaseDate?.toISOString(),
      isActive: doc.isActive,
      genreIds: doc.genreIds,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }
}
