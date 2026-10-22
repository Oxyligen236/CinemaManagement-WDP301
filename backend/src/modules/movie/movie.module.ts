import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Movie, MovieSchema } from './domain/schemas/movie.schema';
import { Genre, GenreSchema } from './domain/schemas/genre.schema';
import { ShowtimeModule } from '../showtime/showtime.module';
import { StorageModule } from '../infra/storage/storage.module';
import { MovieController } from './infra/movie.controller';
import { MovieService } from './application/services/movie.service';

// Module chỉ được import Module cấm import thứ khác
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Movie.name, schema: MovieSchema },
      { name: Genre.name, schema: GenreSchema },
    ]),
    ShowtimeModule,
    StorageModule,
  ],
  controllers: [MovieController],
  providers: [MovieService],
  exports: [MovieService, MongooseModule],
})
export class MovieModule {}
