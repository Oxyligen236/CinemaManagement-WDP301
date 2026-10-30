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

  static from(params: {
    movieId: string;
    movieName: string;
    duration: number;
    status: MovieStatus;
    posterKey?: string;
    posterUrl?: string;
    trailerUrl?: string;
    description?: string;
    releaseDate?: string;
    isActive: boolean;
    genreIds: string[];
    createdAt: Date;
    updatedAt: Date;
  }): MovieResDto {
    const dto = new MovieResDto();
    dto.movieId = params.movieId;
    dto.movieName = params.movieName;
    dto.duration = params.duration;
    dto.status = params.status;
    dto.posterKey = params.posterKey;
    dto.posterUrl = params.posterUrl;
    dto.trailerUrl = params.trailerUrl;
    dto.description = params.description;
    dto.releaseDate = params.releaseDate;
    dto.isActive = params.isActive;
    dto.genreIds = params.genreIds;
    dto.createdAt = params.createdAt;
    dto.updatedAt = params.updatedAt;
    return dto;
  }
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

  static from(params: {
    movieId: string;
    movieName: string;
    duration: number;
    status: string;
    posterUrl?: string;
  }): MovieOptionResDto {
    const dto = new MovieOptionResDto();
    dto.movieId = params.movieId;
    dto.movieName = params.movieName;
    dto.duration = params.duration;
    dto.status = params.status;
    dto.posterUrl = params.posterUrl;
    return dto;
  }
}

export class MovieSchedulingInfoResDto {
  movieId!: string;
  movieName!: string;
  duration!: number;
  status!: string;
  isActive!: boolean;
  posterUrl?: string;

  static from(params: {
    movieId: string;
    movieName: string;
    duration: number;
    status: string;
    isActive: boolean;
    posterUrl?: string;
  }): MovieSchedulingInfoResDto {
    const dto = new MovieSchedulingInfoResDto();
    dto.movieId = params.movieId;
    dto.movieName = params.movieName;
    dto.duration = params.duration;
    dto.status = params.status;
    dto.isActive = params.isActive;
    dto.posterUrl = params.posterUrl;
    return dto;
  }
}

export class GenreResDto {
  genreId!: string;
  genreName!: string;
  genreDescription?: string;

  static from(params: {
    genreId: string;
    genreName: string;
    genreDescription?: string;
  }): GenreResDto {
    const dto = new GenreResDto();
    dto.genreId = params.genreId;
    dto.genreName = params.genreName;
    dto.genreDescription = params.genreDescription;
    return dto;
  }
}

export class GenreItemResDto {
  genreId!: string;
  genreName!: string;

  static from(params: { genreId: string; genreName: string }): GenreItemResDto {
    const dto = new GenreItemResDto();
    dto.genreId = params.genreId;
    dto.genreName = params.genreName;
    return dto;
  }
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

  static from(params: {
    movieId: string;
    movieName: string;
    duration: number;
    status: MovieStatus;
    posterUrl?: string;
    trailerUrl?: string;
    description?: string;
    releaseDate?: string;
    isActive: boolean;
    genreIds: string[];
    genres: GenreItemResDto[];
    createdAt: Date;
    updatedAt: Date;
  }): MovieDetailResDto {
    const dto = new MovieDetailResDto();
    dto.movieId = params.movieId;
    dto.movieName = params.movieName;
    dto.duration = params.duration;
    dto.status = params.status;
    dto.posterUrl = params.posterUrl;
    dto.trailerUrl = params.trailerUrl;
    dto.description = params.description;
    dto.releaseDate = params.releaseDate;
    dto.isActive = params.isActive;
    dto.genreIds = params.genreIds;
    dto.genres = params.genres;
    dto.createdAt = params.createdAt;
    dto.updatedAt = params.updatedAt;
    return dto;
  }
}
