import { TempService } from './application/services/temp.service';
import { TempController } from './infra/temp.controller';
/*
https://docs.nestjs.com/modules
*/

import { Module } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [TempController],
  providers: [TempService],
})
export class TempModule {}
