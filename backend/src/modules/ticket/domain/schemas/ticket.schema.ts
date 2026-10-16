import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';
import { TicketStatus } from '../enums/ticket-status.enum';

export type TicketDocument = HydratedDocument<Ticket>;

@Schema({
  collection: 'tickets',
  timestamps: true,
})
export class Ticket {
  @Prop({
    required: true,
    unique: true,
    default: () => randomUUID(),
  })
  ticketId!: string;

  @Prop({
    required: true,
    trim: true,
  })
  orderId!: string;

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
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);

TicketSchema.index({ ticketCode: 1 }, { unique: true });
TicketSchema.index({ orderId: 1 });
TicketSchema.index({ ticketStatus: 1 });
