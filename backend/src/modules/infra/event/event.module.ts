import { DynamicModule, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { INTERNAL_EVENT_BUS } from './application/internal-event-bus.interface';
import { EventEmitterService } from './event-emitter/event-emitter.service';

@Module({
  imports: [(EventEmitterModule as { forRoot: () => DynamicModule }).forRoot()],
  providers: [
    EventEmitterService,
    {
      provide: INTERNAL_EVENT_BUS,
      useExisting: EventEmitterService,
    },
  ],
  exports: [EventEmitterModule, INTERNAL_EVENT_BUS, EventEmitterService],
})
export class EventModule {}
