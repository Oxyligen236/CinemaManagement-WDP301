export const MOVIE_CONTRACT = Symbol('MOVIE_CONTRACT');

export interface MovieSummaryDto {
  movieId: string;
  movieName: string;
  duration: number;
  posterUrl?: string;
  status: string;
  releaseDate?: Date;
}

export interface MovieContract {
  getMovieSummary(movieId: string): Promise<MovieSummaryDto | null>;
  getMoviesSummary(movieIds: string[]): Promise<MovieSummaryDto[]>;
}
