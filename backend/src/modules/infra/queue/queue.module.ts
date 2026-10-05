import { Module } from '@nestjs/common';
import { BullmqModule } from './bullmq/bullmq.module';

@Module({
  imports: [BullmqModule],
  exports: [BullmqModule],
})
export class QueueModule {}
