import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Ticket, TicketSchema } from './domain/schemas/ticket.schema';
import { ShowtimeModule } from '../showtime/showtime.module';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { EventModule } from '../infra/event/event.module';
import { TicketController } from './infra/controllers/ticket.controller';
import { TicketService } from './application/services/ticket.service';
import { TICKET_CONTRACT } from './contracts/ticket.contract';
import { TicketContractImpl } from './contracts/ticket-contract.impl';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Ticket.name, schema: TicketSchema }]),
    ShowtimeModule,
    AuthModule,
    UserModule,
    EventModule,
  ],
  controllers: [TicketController],
  providers: [
    TicketService,
    TicketContractImpl,
    {
      provide: TICKET_CONTRACT,
      useClass: TicketContractImpl,
    },
  ],
  exports: [TicketService, TICKET_CONTRACT],
})
export class TicketModule {}
