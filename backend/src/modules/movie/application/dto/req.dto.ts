import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PageRequest } from '../../../../common/dto/page.dto';
import {
  MSG11,
  MSG_INVALID_POSTER_KEY,
  POSTER_KEY_PATTERN,
} from '../../domain/constants/movie-asset.constants';
import { MovieStatus } from '../../domain/enums/movie-status.enum';

export class CreateMovieReqDto {
  @IsNotEmpty({ message: 'The title field is required.' })
  @IsString()
  movieName!: string;

  @IsNotEmpty({ message: 'The duration field is required.' })
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Duration must be at least 1 minute' })
  duration!: number;

  @IsNotEmpty({ message: 'The genre field is required.' })
  @IsArray()
  @IsString({ each: true })
  genreIds!: string[];

  @IsOptional()
  @IsDateString()
  releaseDate?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(POSTER_KEY_PATTERN, { message: MSG_INVALID_POSTER_KEY })
  posterKey?: string;

  @IsOptional()
  @IsString({ message: MSG11 })
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: MSG11 },
  )
  @MaxLength(2048, { message: MSG11 })
  trailerUrl?: string;

  @IsOptional()
  @IsEnum(MovieStatus)
  status?: MovieStatus = MovieStatus.COMING_SOON;
}

export class SearchMovieReqDto extends PageRequest {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  genreId?: string;

  @IsOptional()
  @IsEnum(MovieStatus)
  status?: MovieStatus;

  @IsOptional()
  @IsDateString()
  releaseDate?: string;
}
