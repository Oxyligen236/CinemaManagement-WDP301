import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ScanTicketUsecase } from '../usecase/scan-ticket.usecase';
import { GetTicketDetailUsecase } from '../usecase/get-ticket-detail.usecase';
import {
  SHOWTIME_CONTRACT,
  ShowtimeContract,
} from '../../contracts/showtime.contract';
import {
  INTERNAL_EVENT_BUS,
  InternalEventBus,
} from '../../../infra/event/application/internal-event-bus.interface';
import { Ticket, TicketDocument } from '../../domain/schemas/ticket.schema';
import { TicketStatus } from '../../domain/enums/ticket-status.enum';
import { ScanTicketReq } from '../dto/req.dto';
import { ScanTicketResultRes, TicketDetailRes } from '../dto/res.dto';
import { TicketItemSummaryDto } from '../dto/ticket-summary.dto';
import { TicketScannedEvent } from '../../domain/events/ticket-scanned.event';

@Injectable()
export class TicketService
  implements ScanTicketUsecase, GetTicketDetailUsecase
{
  constructor(
    @InjectModel(Ticket.name)
    private readonly ticketModel: Model<TicketDocument>,
    @Inject(SHOWTIME_CONTRACT)
    private readonly showtimeContract: ShowtimeContract,
    @Inject(INTERNAL_EVENT_BUS)
    private readonly eventBus: InternalEventBus,
  ) {}

  async scanTicket(
    dto: ScanTicketReq,
    staffId: string,
  ): Promise<ScanTicketResultRes> {
    const normalizedCode = (dto.ticketCode || '').trim();
    if (!normalizedCode) {
      throw new BadRequestException('Mã vé không được để trống');
    }
    const ticket = await this.ticketModel
      .findOne({ ticketCode: normalizedCode })
      .exec();

    if (!ticket) {
      throw new NotFoundException(`Mã vé không tồn tại: ${normalizedCode}`);
    }

    if (ticket.ticketStatus === TicketStatus.USED) {
      throw new BadRequestException(
        `Vé đã được sử dụng vào lúc ${ticket.usedAt?.toISOString() || 'trước đó'}`,
      );
    }

    if (ticket.ticketStatus !== TicketStatus.VALID) {
      throw new BadRequestException(
        `Vé không hợp lệ (trạng thái: ${ticket.ticketStatus})`,
      );
    }

    const showtimeDetail = await this.showtimeContract.getSeatShowtimeDetail(
      ticket.seatShowtimeId,
    );

    if (!showtimeDetail) {
      throw new BadRequestException(
        'Không tìm thấy thông tin suất chiếu cho vé',
      );
    }

    if (dto.showtimeId && showtimeDetail.showtimeId !== dto.showtimeId) {
      throw new BadRequestException(
        `Vé không thuộc suất chiếu đang chọn (Phim: ${showtimeDetail.movieTitle}, Suất: ${showtimeDetail.startTime.toISOString()})`,
      );
    }

    const now = new Date();
    const checkinStartTime = new Date(
      showtimeDetail.startTime.getTime() - 30 * 60 * 1000,
    );
    const checkinEndTime = showtimeDetail.endTime;

    if (now < checkinStartTime) {
      throw new BadRequestException(
        'Chưa đến giờ soát vé. Thời gian soát vé bắt đầu trước 30 phút giờ chiếu',
      );
    }

    if (now > checkinEndTime) {
      throw new BadRequestException(
        'Suất chiếu đã kết thúc, vé đã hết hạn sử dụng',
      );
    }

    const scannedAt = new Date();
    ticket.ticketStatus = TicketStatus.USED;
    ticket.usedAt = scannedAt;
    ticket.scannedBy = staffId;
    await ticket.save();

    await this.eventBus.publish(
      new TicketScannedEvent(
        ticket.ticketId,
        ticket.ticketCode,
        staffId,
        scannedAt,
      ),
    );

    const seatLabel = `${showtimeDetail.rowPosition || ''}${showtimeDetail.columnPosition || ''}`;

    return ScanTicketResultRes.of(
      ticket.ticketId,
      ticket.ticketCode,
      ticket.orderId,
      ticket.price,
      ticket.ticketStatus,
      ticket.usedAt,
      ticket.seatShowtimeId,
      showtimeDetail.movieTitle,
      showtimeDetail.roomName,
      seatLabel,
      showtimeDetail.startTime,
      showtimeDetail.endTime,
      staffId,
      scannedAt,
      'Soát vé thành công',
    );
  }

  async getTicketDetail(ticketCode: string): Promise<TicketDetailRes> {
    const normalizedCode = (ticketCode || '').trim();
    const ticket = await this.ticketModel
      .findOne({ ticketCode: normalizedCode })
      .exec();

    if (!ticket) {
      throw new NotFoundException(
        `Ticket with code ${normalizedCode} not found`,
      );
    }

    const showtimeDetail = await this.showtimeContract.getSeatShowtimeDetail(
      ticket.seatShowtimeId,
    );

    const seatLabel = showtimeDetail
      ? `${showtimeDetail.rowPosition || ''}${showtimeDetail.columnPosition || ''}`
      : '';

    return TicketDetailRes.of(
      ticket.ticketId,
      ticket.ticketCode,
      ticket.orderId,
      ticket.price,
      ticket.ticketStatus,
      ticket.usedAt,
      ticket.seatShowtimeId,
      showtimeDetail?.movieTitle ?? '',
      showtimeDetail?.roomName ?? '',
      seatLabel,
      showtimeDetail?.startTime ?? new Date(),
      showtimeDetail?.endTime ?? new Date(),
    );
  }

  async getTicketsByOrderId(orderId: string): Promise<TicketItemSummaryDto[]> {
    const tickets = await this.ticketModel.find({ orderId }).exec();
    if (!tickets || tickets.length === 0) {
      return [];
    }

    const results: TicketItemSummaryDto[] = [];
    for (const ticket of tickets) {
      const showtimeDetail = await this.showtimeContract.getSeatShowtimeDetail(
        ticket.seatShowtimeId,
      );
      const seatLabel = showtimeDetail
        ? `${showtimeDetail.rowPosition || ''}${showtimeDetail.columnPosition || ''}`
        : '';

      results.push({
        ticketId: ticket.ticketId,
        ticketCode: ticket.ticketCode,
        price: ticket.price,
        ticketStatus: ticket.ticketStatus,
        usedAt: ticket.usedAt,
        seatShowtimeId: ticket.seatShowtimeId,
        movieTitle: showtimeDetail?.movieTitle ?? '',
        roomName: showtimeDetail?.roomName ?? '',
        seatLabel,
        startTime: showtimeDetail?.startTime ?? new Date(),
        endTime: showtimeDetail?.endTime ?? new Date(),
      });
    }

    return results;
  }
}
