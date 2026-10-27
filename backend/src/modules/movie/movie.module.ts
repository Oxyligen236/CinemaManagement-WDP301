import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Movie, MovieSchema } from './domain/schemas/movie.schema';
import { Genre, GenreSchema } from './domain/schemas/genre.schema';
import { ShowtimeModule } from '../showtime/showtime.module';
import { StorageModule } from '../infra/storage/storage.module';
import { MovieController } from './infra/movie.controller';
import { MovieService } from './application/services/movie.service';
import { MovieOptionQueryService } from './application/services/movie-option-query.service';
import { MOVIE_CONTRACT } from './contracts/movie.contract';
import { MovieContractImpl } from './contracts/movie-contract.impl';

// Module chỉ được import Module cấm import thứ khác
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Movie.name, schema: MovieSchema },
      { name: Genre.name, schema: GenreSchema },
    ]),
    forwardRef(() => ShowtimeModule),
    StorageModule,
  ],
  controllers: [MovieController],
  providers: [
    MovieService,
    MovieOptionQueryService,
    MovieContractImpl,
    {
      provide: MOVIE_CONTRACT,
      useClass: MovieContractImpl,
    },
  ],
  exports: [
    MongooseModule,
    MovieService,
    MovieOptionQueryService,
    MOVIE_CONTRACT,
  ],
})
export class MovieModule {}
