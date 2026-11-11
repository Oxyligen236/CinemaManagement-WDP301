import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../infra/storage/storage.module';
import { ShowtimeModule } from '../showtime/showtime.module';
import { MovieOptionQueryService } from './application/services/movie-option-query.service';
import { MovieService } from './application/services/movie.service';
import { MovieController } from './infra/movie.controller';

@Module({
  imports: [AuthModule, StorageModule, forwardRef(() => ShowtimeModule)],
  controllers: [MovieController],
  providers: [MovieService, MovieOptionQueryService],
  exports: [MovieService, MovieOptionQueryService],
})
export class MovieModule {}
