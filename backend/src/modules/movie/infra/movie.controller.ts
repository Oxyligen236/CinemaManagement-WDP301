import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseFilters,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  CreateMovieReqDto,
  SearchMovieReqDto,
} from '../application/dto/req.dto';
import { MovieService } from '../application/services/movie.service';
import { POSTER_MAX_SIZE } from '../domain/constants/movie-asset.constants';
import { MulterFileSizeExceptionFilter } from './multer-file-size.filter';

// TODO: gắn guard phân quyền Admin (JwtGuard/RoleGuard) cho các endpoint ghi khi chốt phân quyền.
@Controller('movies')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class MovieController {
  constructor(private readonly movieService: MovieService) {}

  @Get()
  searchMovies(@Query() query: SearchMovieReqDto) {
    return this.movieService.searchMovies(query);
  }

  @Get('genres')
  getGenres() {
    return this.movieService.getGenres();
  }

  @Get(':id')
  getMovieDetail(@Param('id') id: string) {
    return this.movieService.getMovieDetail(id);
  }

  // Multer chặn file lớn hơn 5MB + 1 byte; file vượt đúng 5MB do service kiểm tra (MSG09).
  @Post('assets/upload')
  @UseFilters(MulterFileSizeExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: POSTER_MAX_SIZE + 1 } }),
  )
  uploadAsset(@UploadedFile() file: Express.Multer.File) {
    return this.movieService.uploadAsset(file);
  }

  @Post()
  createMovie(@Body() body: CreateMovieReqDto) {
    return this.movieService.createMovie(body);
  }

  @Patch(':id/deactivate')
  deactivateMovie(@Param('id') id: string) {
    return this.movieService.deactivateMovie(id);
  }
}
