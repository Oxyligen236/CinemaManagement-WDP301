import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BranchModule } from '../branch/branch.module';
import { MovieModule } from '../movie/movie.module';
import { PriceRuleModule } from '../pricerule/pricerule.module';
import { RoomModule } from '../room/room.module';
import { ShowtimeModule } from '../showtime/showtime.module';
import { UserModule } from '../user/user.module';
import { ManagedShowtimeService } from './application/services/managed-showtime.service';
import { ShowtimeFormOptionService } from './application/services/showtime-form-option.service';
import { ManagedShowtimeController } from './infra/managed-showtime.controller';

// Module chỉ được import Module cấm import thứ khác
@Module({
  imports: [
    AuthModule,
    ShowtimeModule,
    MovieModule,
    RoomModule,
    BranchModule,
    UserModule,
    PriceRuleModule,
  ],
  controllers: [ManagedShowtimeController],
  providers: [ManagedShowtimeService, ShowtimeFormOptionService],
  exports: [],
})
export class ShowtimeManagementModule {}
