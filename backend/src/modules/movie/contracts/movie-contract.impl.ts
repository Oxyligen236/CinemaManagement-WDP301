import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  STORAGE_SERVICE,
  type StorageService,
} from '../../infra/storage/application/interface/storage.interface';
import { MovieContract, MovieSummaryDto } from './movie.contract';

@Injectable()
export class MovieContractImpl implements MovieContract {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storageService: StorageService,
  ) {}

  async getMovieSummary(movieId: string): Promise<MovieSummaryDto | null> {
    const movie = await this.prisma.movie.findUnique({ where: { id: movieId } });
    if (!movie) {
      return null;
    }
    return this.toSummary(movie);
  }

  async getMoviesSummary(movieIds: string[]): Promise<MovieSummaryDto[]> {
    if (!movieIds || movieIds.length === 0) {
      return [];
    }
    const movies = await this.prisma.movie.findMany({
      where: { id: { in: movieIds } },
    });
    return movies.map((movie) => this.toSummary(movie));
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

  private toSummary(movie: any): MovieSummaryDto {
    return {
      movieId: movie.id,
      movieName: movie.movieName,
      duration: movie.duration,
      posterUrl: this.resolvePosterUrl(movie.posterKey),
      status: movie.status,
      releaseDate: movie.releaseDate ? new Date(movie.releaseDate) : undefined,
    };
  }
}
