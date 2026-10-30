import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  STORAGE_SERVICE,
  type StorageService,
} from '../../infra/storage/application/interface/storage.interface';
import { Movie, MovieDocument } from '../domain/schemas/movie.schema';
import { MovieContract, MovieSummaryDto } from './movie.contract';

@Injectable()
export class MovieContractImpl implements MovieContract {
  constructor(
    @InjectModel(Movie.name) private readonly movieModel: Model<MovieDocument>,
    @Inject(STORAGE_SERVICE) private readonly storageService: StorageService,
  ) {}

  async getMovieSummary(movieId: string): Promise<MovieSummaryDto | null> {
    const movie = await this.movieModel.findById(movieId).lean().exec();
    if (!movie) {
      return null;
    }
    return this.toSummary(movie);
  }

  async getMoviesSummary(movieIds: string[]): Promise<MovieSummaryDto[]> {
    if (!movieIds || movieIds.length === 0) {
      return [];
    }
    const movies = await this.movieModel
      .find({ _id: { $in: movieIds } })
      .lean()
      .exec();
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
      movieId: (movie._id ?? movie.movieId)?.toString(),
      movieName: movie.movieName,
      duration: movie.duration,
      posterUrl: this.resolvePosterUrl(movie.posterKey),
      status: movie.status,
      releaseDate: movie.releaseDate ? new Date(movie.releaseDate) : undefined,
    };
  }
}
