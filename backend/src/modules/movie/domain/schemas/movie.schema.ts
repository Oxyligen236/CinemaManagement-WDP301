import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';
import { MovieStatus } from '../enums/movie-status.enum';

export type MovieDocument = HydratedDocument<Movie>;

@Schema({
  collection: 'movies',
  timestamps: true,
})
export class Movie {
  @Prop({
    required: true,
    unique: true,
    default: () => randomUUID(),
  })
  movieId!: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 255,
  })
  movieName!: string;

  @Prop({
    required: true,
  })
  duration!: number;

  @Prop({
    type: String,
    enum: MovieStatus,
    default: MovieStatus.COMING_SOON,
    required: true,
  })
  status!: MovieStatus;

  @Prop({
    trim: true,
  })
  posterKey?: string;

  @Prop({
    trim: true,
  })
  trailerKey?: string;

  @Prop({
    required: true,
    default: true,
  })
  isActive!: boolean;

  @Prop({
    type: [String],
    default: [],
  })
  genreIds!: string[];
}

export const MovieSchema = SchemaFactory.createForClass(Movie);

MovieSchema.index({ movieName: 1 });
MovieSchema.index({ status: 1, isActive: 1 });
