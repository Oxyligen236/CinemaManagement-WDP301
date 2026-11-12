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

  static of(params: {
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
    const res = new MovieResDto();
    Object.assign(res, params);
    return res;
  }
}

export class UploadMovieAssetResDto {
  storageKey!: string;
  url!: string;
  originalName!: string;
  size!: number;
  contentType!: string;

  static of(
    storageKey: string,
    url: string,
    originalName: string,
    size: number,
    contentType: string,
  ): UploadMovieAssetResDto {
    const res = new UploadMovieAssetResDto();
    Object.assign(res, {
      storageKey,
      url,
      originalName,
      size,
      contentType,
    });
    return res;
  }
}

export class MovieOptionResDto {
  movieId!: string;
  movieName!: string;
  duration!: number;
  status!: string;
  posterUrl?: string;

  static of(
    movieId: string,
    movieName: string,
    duration: number,
    status: string,
    posterUrl?: string,
  ): MovieOptionResDto {
    const res = new MovieOptionResDto();
    Object.assign(res, {
      movieId,
      movieName,
      duration,
      status,
      posterUrl,
    });
    return res;
  }
}

export class MovieSchedulingInfoResDto {
  movieId!: string;
  movieName!: string;
  duration!: number;
  status!: string;
  isActive!: boolean;
  posterUrl?: string;

  static of(
    movieId: string,
    movieName: string,
    duration: number,
    status: string,
    isActive: boolean,
    posterUrl?: string,
  ): MovieSchedulingInfoResDto {
    const res = new MovieSchedulingInfoResDto();
    Object.assign(res, {
      movieId,
      movieName,
      duration,
      status,
      isActive,
      posterUrl,
    });
    return res;
  }
}

export class GenreResDto {
  genreId!: string;
  genreName!: string;
  genreDescription?: string;

  static of(
    genreId: string,
    genreName: string,
    genreDescription?: string,
  ): GenreResDto {
    const res = new GenreResDto();
    Object.assign(res, {
      genreId,
      genreName,
      genreDescription,
    });
    return res;
  }
}

export class GenreItemResDto {
  genreId!: string;
  genreName!: string;

  static of(genreId: string, genreName: string): GenreItemResDto {
    const res = new GenreItemResDto();
    Object.assign(res, {
      genreId,
      genreName,
    });
    return res;
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

  static of(params: {
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
    const res = new MovieDetailResDto();
    Object.assign(res, params);
    return res;
  }
}

export class MovieSummaryResDto {
  movieId!: string;
  movieName!: string;
  duration!: number;
  posterUrl?: string;
  status!: string;
  releaseDate?: Date;

  static of(
    movieId: string,
    movieName: string,
    duration: number,
    status: string,
    posterUrl?: string,
    releaseDate?: Date,
  ): MovieSummaryResDto {
    const res = new MovieSummaryResDto();
    Object.assign(res, {
      movieId,
      movieName,
      duration,
      status,
      posterUrl,
      releaseDate,
    });
    return res;
  }
}
