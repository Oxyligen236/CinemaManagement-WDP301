import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { TicketStatus } from '../enums/ticket-status.enum';

export type TicketDocument = HydratedDocument<Ticket>;

@Schema({
  collection: 'tickets',
  timestamps: true,
})
export class Ticket {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Order',
    required: true,
  })
  orderId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'SeatShowtime',
    required: true,
  })
  seatShowtimeId!: Types.ObjectId;

  @Prop({
    required: true,
    unique: true,
    trim: true,
  })
  ticketCode!: string;

  @Prop({
    required: true,
    min: 0,
  })
  price!: number;

  @Prop({
    type: String,
    enum: TicketStatus,
    default: TicketStatus.VALID,
    required: true,
  })
  ticketStatus!: TicketStatus;

  @Prop()
  usedAt?: Date;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: false,
  })
  scannedBy?: Types.ObjectId;
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);

TicketSchema.index({ ticketCode: 1 }, { unique: true });
TicketSchema.index({ orderId: 1 });
TicketSchema.index({ seatShowtimeId: 1 });
TicketSchema.index({ ticketStatus: 1 });
