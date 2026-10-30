import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type GenreDocument = HydratedDocument<Genre>;

@Schema({
  collection: 'genres',
  timestamps: true,
})
export class Genre {
  _id!: Types.ObjectId;

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
