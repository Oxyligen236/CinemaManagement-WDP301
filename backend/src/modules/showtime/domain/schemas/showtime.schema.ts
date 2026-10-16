import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';

export type ShowtimeDocument = HydratedDocument<Showtime>;

@Schema({
  collection: 'showtimes',
  timestamps: true,
})
export class Showtime {
  @Prop({
    required: true,
    unique: true,
    default: () => randomUUID(),
  })
  showtimeId!: string;

  @Prop({
    required: true,
    trim: true,
  })
  movieId!: string;

  @Prop({
    required: true,
    trim: true,
  })
  roomId!: string;

  @Prop({
    required: true,
  })
  startTime!: Date;

  @Prop({
    required: true,
  })
  endTime!: Date;

  @Prop({
    required: true,
    min: 0,
  })
  basePrice!: number;

  @Prop({
    trim: true,
  })
  dayPriceRuleId?: string;

  @Prop({
    trim: true,
  })
  seatPriceRuleId?: string;
}

export const ShowtimeSchema = SchemaFactory.createForClass(Showtime);

ShowtimeSchema.index({ movieId: 1, startTime: 1 });
ShowtimeSchema.index({ roomId: 1, startTime: 1, endTime: 1 });
