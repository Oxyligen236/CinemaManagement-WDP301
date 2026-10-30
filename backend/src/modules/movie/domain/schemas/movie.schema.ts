import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { MovieStatus } from '../enums/movie-status.enum';

export type MovieDocument = HydratedDocument<Movie>;

@Schema({
  collection: 'movies',
  timestamps: true,
})
export class Movie {
  _id!: Types.ObjectId;

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
    default: '',
  })
  description?: string;

  @Prop({ type: Date })
  releaseDate?: Date;

  @Prop({
    required: true,
    trim: true,
  })
  posterKey!: string;

  @Prop({
    trim: true,
    maxlength: 2048,
  })
  trailerUrl?: string;

  @Prop({
    required: true,
    default: true,
  })
  isActive!: boolean;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Genre' }],
    default: [],
  })
  genreIds!: Types.ObjectId[];
}

export const MovieSchema = SchemaFactory.createForClass(Movie);

MovieSchema.index({ movieName: 1 });
MovieSchema.index({ status: 1, isActive: 1 });
