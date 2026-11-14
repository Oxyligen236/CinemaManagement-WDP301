import { Test, TestingModule } from '@nestjs/testing';
import { MovieStatus } from '../domain/enums/movie-status.enum';
import { MovieService } from '../application/services/movie.service';
import { MovieController } from './movie.controller';

describe('MovieController', () => {
  let controller: MovieController;
  let movieService: jest.Mocked<MovieService>;

  beforeEach(async () => {
    movieService = {
      searchMovies: jest.fn(),
      getGenres: jest.fn(),
      getMovieDetail: jest.fn(),
      uploadAsset: jest.fn(),
      createMovie: jest.fn(),
      deactivateMovie: jest.fn(),
    } as unknown as jest.Mocked<MovieService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MovieController],
      providers: [{ provide: MovieService, useValue: movieService }],
    }).compile();

    controller = module.get(MovieController);
  });

  it('delegates searchMovies', async () => {
    const query = { keyword: 'Dune', page: 1, limit: 10 };
    const page = { items: [], total: 0, page: 1, limit: 10 };
    movieService.searchMovies.mockResolvedValue(page as any);

    await expect(controller.searchMovies(query)).resolves.toEqual(page);
    expect(movieService.searchMovies).toHaveBeenCalledWith(query);
  });

  it('delegates getGenres', async () => {
    const genres = [{ genreId: 'g-1', genreName: 'Action' }];
    movieService.getGenres.mockResolvedValue(genres as any);

    await expect(controller.getGenres()).resolves.toEqual(genres);
    expect(movieService.getGenres).toHaveBeenCalledTimes(1);
  });

  it('delegates getMovieDetail', async () => {
    const detail = { movieId: 'm-1' };
    movieService.getMovieDetail.mockResolvedValue(detail as any);

    await expect(controller.getMovieDetail('m-1')).resolves.toEqual(detail);
    expect(movieService.getMovieDetail).toHaveBeenCalledWith('m-1');
  });

  it('delegates uploadAsset', async () => {
    const file = { originalname: 'poster.png' } as Express.Multer.File;
    const res = { storageKey: 'movies/posters/1.png' };
    movieService.uploadAsset.mockResolvedValue(res as any);

    await expect(controller.uploadAsset(file)).resolves.toEqual(res);
    expect(movieService.uploadAsset).toHaveBeenCalledWith(file);
  });

  it('delegates createMovie', async () => {
    const body = {
      movieName: 'Dune',
      duration: 150,
      genreIds: ['g-1'],
      posterKey: 'movies/posters/1.png',
      status: MovieStatus.COMING_SOON,
    };
    const created = { movieId: 'm-1' };
    movieService.createMovie.mockResolvedValue(created as any);

    await expect(controller.createMovie(body)).resolves.toEqual(created);
    expect(movieService.createMovie).toHaveBeenCalledWith(body);
  });

  it('delegates deactivateMovie', async () => {
    const updated = { movieId: 'm-1', isActive: false };
    movieService.deactivateMovie.mockResolvedValue(updated as any);

    await expect(controller.deactivateMovie('m-1')).resolves.toEqual(updated);
    expect(movieService.deactivateMovie).toHaveBeenCalledWith('m-1');
  });
});
