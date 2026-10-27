import { MovieStatus } from '../../domain/enums/movie-status.enum';

export class MovieResDto {
  movieId!: string;
  movieName!: string;
  duration!: number;
  status!: MovieStatus;
  posterKey?: string;
  posterUrl?: string;
  trailerUrl?: string;
  description?: string;
  releaseDate?: string;
  isActive!: boolean;
  genreIds!: string[];
  createdAt!: Date;
  updatedAt!: Date;
}

export class UploadMovieAssetResDto {
  storageKey!: string;
  url!: string;
  originalName!: string;
  size!: number;
  contentType!: string;
}

export class MovieOptionResDto {
  movieId!: string;
  movieName!: string;
  duration!: number;
  status!: string;
  posterUrl?: string;
}

export class MovieSchedulingInfoResDto {
  movieId!: string;
  movieName!: string;
  duration!: number;
  status!: string;
  isActive!: boolean;
  posterUrl?: string;
}

export class GenreResDto {
  genreId!: string;
  genreName!: string;
  genreDescription?: string;
}

export class GenreItemResDto {
  genreId!: string;
  genreName!: string;
}

export class MovieDetailResDto {
  movieId!: string;
  movieName!: string;
  duration!: number;
  status!: MovieStatus;
  posterUrl?: string;
  trailerUrl?: string;
  description?: string;
  releaseDate?: string;
  isActive!: boolean;
  genreIds!: string[];
  genres!: GenreItemResDto[];
  createdAt!: Date;
  updatedAt!: Date;
}
