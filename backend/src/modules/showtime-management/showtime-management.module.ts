import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BranchModule } from '../branch/branch.module';
import { MovieModule } from '../movie/movie.module';
import { PriceRuleModule } from '../pricerule/pricerule.module';
import { RoomModule } from '../room/room.module';
import { ShowtimeModule } from '../showtime/showtime.module';
import { UserModule } from '../user/user.module';
import { ShowtimeManagementService } from './application/services/showtime-management.service';
import { ShowtimeManagementController } from './infra/showtime-management.controller';

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
  controllers: [ShowtimeManagementController],
  providers: [ShowtimeManagementService],
})
export class ShowtimeManagementModule {}
