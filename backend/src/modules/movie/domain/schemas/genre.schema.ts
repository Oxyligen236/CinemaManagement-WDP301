import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';

export type GenreDocument = HydratedDocument<Genre>;

@Schema({
  collection: 'genres',
  timestamps: true,
})
export class Genre {
  @Prop({
    required: true,
    unique: true,
    default: () => randomUUID(),
  })
  genreId!: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 100,
  })
  genreName!: string;

  @Prop({
    trim: true,
    default: '',
  })
  genreDescription?: string;
}

export const GenreSchema = SchemaFactory.createForClass(Genre);

GenreSchema.index({ genreName: 1 });
