import { Inject, Injectable } from '@nestjs/common';
import { Page } from '../../../../common/dto/page.dto';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import {
  STORAGE_SERVICE,
  type StorageService,
} from '../../../infra/storage/application/interface/storage.interface';
import { MovieStatus } from '@prisma/client';
import { MovieOptionResDto, MovieSchedulingInfoResDto } from '../dto/res.dto';

@Injectable()
export class MovieOptionQueryService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storageService: StorageService,
  ) {}

  async searchMovieOptions(
    keyword: string | undefined,
    page: number,
    limit: number,
  ): Promise<Page<MovieOptionResDto>> {
    const where: any = {
      isActive: true,
      status: { not: MovieStatus.ENDED },
    };

    const trimmed = keyword?.trim();
    if (trimmed) {
      where.movieName = { contains: trimmed, mode: 'insensitive' };
    }

    const [docs, total] = await Promise.all([
      this.prisma.movie.findMany({
        where,
        orderBy: { movieName: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.movie.count({ where }),
    ]);

    const items = docs.map((doc) => this.toOption(doc));
    return Page.from(items, total, page, limit);
  }

  async getMovieSchedulingInfo(
    movieId: string,
  ): Promise<MovieSchedulingInfoResDto | null> {
    const doc = await this.prisma.movie.findUnique({
      where: { id: movieId },
    });
    return doc ? this.toSchedulingInfo(doc) : null;
  }

  async getMovieSchedulingInfos(
    movieIds: string[],
  ): Promise<MovieSchedulingInfoResDto[]> {
    if (!movieIds || movieIds.length === 0) return [];
    const docs = await this.prisma.movie.findMany({
      where: { id: { in: movieIds } },
    });
    return docs.map((doc) => this.toSchedulingInfo(doc));
  }

  private toOption(doc: any): MovieOptionResDto {
    return MovieOptionResDto.of(
      doc.id,
      doc.movieName,
      doc.duration,
      doc.status,
      this.resolvePosterUrl(doc.posterKey),
    );
  }

  private toSchedulingInfo(doc: any): MovieSchedulingInfoResDto {
    return MovieSchedulingInfoResDto.of(
      doc.id,
      doc.movieName,
      doc.duration,
      doc.status,
      doc.isActive,
      this.resolvePosterUrl(doc.posterKey),
    );
  }

  private resolvePosterUrl(posterKey?: string): string | undefined {
    if (!posterKey) {
      return undefined;
    }
    try {
      return this.storageService.getPublicUrl(posterKey);
    } catch {
      return undefined;
    }
  }
}
