import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { randomUUID } from 'crypto';
import { Role } from '../../../auth/infra/decorators/role.decorator';
import { ScanTicketUsecase } from '../usecase/scan-ticket.usecase';
import { GetTicketDetailUsecase } from '../usecase/get-ticket-detail.usecase';
import { CreateTicketsForOrderUsecase } from '../usecase/create-tickets-for-order.usecase';
import {
  SHOWTIME_CONTRACT,
  ShowtimeContract,
} from '../../../showtime/contracts/showtime.contract';
import {
  INTERNAL_EVENT_BUS,
  InternalEventBus,
} from '../../../infra/event/application/internal-event-bus.interface';
import { TicketStatus } from '@prisma/client';
import { ScanTicketReq, StaffScanContextReq } from '../dto/req.dto';
import {
  ScanTicketResultRes,
  TicketDetailRes,
  TicketItemSummaryRes,
} from '../dto/res.dto';
import { TicketScannedEvent } from '../../domain/events/ticket-scanned.event';

@Injectable()
export class TicketService
  implements
    ScanTicketUsecase,
    GetTicketDetailUsecase,
    CreateTicketsForOrderUsecase
{
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SHOWTIME_CONTRACT)
    private readonly showtimeContract: ShowtimeContract,
    @Inject(INTERNAL_EVENT_BUS)
    private readonly eventBus: InternalEventBus,
  ) {}

  async scanTicket(
    dto: ScanTicketReq,
    staffContext: StaffScanContextReq,
  ): Promise<ScanTicketResultRes> {
    const normalizedCode = (dto.ticketCode || '').trim();
    if (!normalizedCode) {
      throw new BadRequestException('Mã vé không được để trống');
    }
    const ticket = await this.prisma.ticket.findUnique({
      where: { ticketCode: normalizedCode },
    });

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

    if (staffContext.role === Role.STAFF) {
      if (!staffContext.branchId) {
        throw new ForbiddenException(
          'Nhân viên chưa được gán chi nhánh làm việc',
        );
      }
      if (staffContext.branchId !== showtimeDetail.branchId) {
        throw new ForbiddenException(
          `Vé này thuộc chi nhánh "${showtimeDetail.branchName}". Không thể soát tại chi nhánh khác!`,
        );
      }
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
    const updated = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        ticketStatus: TicketStatus.USED,
        usedAt: scannedAt,
        scannedBy: staffContext.staffId,
      },
    });

    await this.eventBus.publish(
      new TicketScannedEvent(
        updated.id,
        updated.ticketCode,
        staffContext.staffId,
        scannedAt,
      ),
    );

    const seatLabel = `${showtimeDetail.rowPosition || ''}${showtimeDetail.columnPosition || ''}`;

    return ScanTicketResultRes.of(
      updated.id,
      updated.ticketCode,
      updated.orderId,
      updated.price,
      updated.ticketStatus as any,
      updated.usedAt ?? undefined,
      updated.seatShowtimeId,
      showtimeDetail.movieTitle,
      showtimeDetail.roomName,
      seatLabel,
      showtimeDetail.startTime,
      showtimeDetail.endTime,
      showtimeDetail.branchId,
      showtimeDetail.branchName,
      showtimeDetail.branchAddress,
      staffContext.staffId,
      scannedAt,
      'Soát vé thành công',
    );
  }

  async getTicketDetail(ticketCode: string): Promise<TicketDetailRes> {
    const normalizedCode = (ticketCode || '').trim();
    const ticket = await this.prisma.ticket.findUnique({
      where: { ticketCode: normalizedCode },
    });

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
      ticket.id,
      ticket.ticketCode,
      ticket.orderId,
      ticket.price,
      ticket.ticketStatus as any,
      ticket.usedAt ?? undefined,
      ticket.seatShowtimeId,
      showtimeDetail?.movieTitle ?? '',
      showtimeDetail?.roomName ?? '',
      seatLabel,
      showtimeDetail?.startTime ?? new Date(),
      showtimeDetail?.endTime ?? new Date(),
      showtimeDetail?.branchId,
      showtimeDetail?.branchName,
      showtimeDetail?.branchAddress,
    );
  }

  async getTicketsByOrderId(
    orderId: string,
    prismaTx?: any,
  ): Promise<TicketItemSummaryRes[]> {
    const client = prismaTx ?? this.prisma;
    const tickets = await client.ticket.findMany({ where: { orderId } });
    if (!tickets || tickets.length === 0) {
      return [];
    }

    const results: TicketItemSummaryRes[] = [];
    for (const ticket of tickets) {
      const showtimeDetail = await this.showtimeContract.getSeatShowtimeDetail(
        ticket.seatShowtimeId,
      );
      const seatLabel = showtimeDetail
        ? `${showtimeDetail.rowPosition || ''}${showtimeDetail.columnPosition || ''}`
        : '';

      results.push({
        ticketId: ticket.id,
        ticketCode: ticket.ticketCode,
        price: ticket.price,
        ticketStatus: ticket.ticketStatus,
        usedAt: ticket.usedAt ?? undefined,
        seatShowtimeId: ticket.seatShowtimeId,
        movieTitle: showtimeDetail?.movieTitle ?? '',
        roomName: showtimeDetail?.roomName ?? '',
        seatLabel,
        startTime: showtimeDetail?.startTime ?? new Date(),
        endTime: showtimeDetail?.endTime ?? new Date(),
        branchId: showtimeDetail?.branchId,
        branchName: showtimeDetail?.branchName,
        branchAddress: showtimeDetail?.branchAddress,
      });
    }

    return results;
  }

  async createTicketsForOrder(
    params: {
      orderId: string;
      seatShowtimeIds: string[];
    },
    prismaTx?: any,
  ): Promise<TicketItemSummaryRes[]> {
    const client = prismaTx ?? this.prisma;
    const { orderId, seatShowtimeIds } = params;
    if (!orderId) {
      throw new BadRequestException('Mã đơn hàng không được để trống');
    }
    const existing = await this.getTicketsByOrderId(orderId, client);
    if (existing.length > 0) {
      return existing;
    }

    if (!seatShowtimeIds || seatShowtimeIds.length === 0) {
      throw new BadRequestException('Danh sách ghế không được để trống');
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const ticketsToCreate = [];

    for (const seatShowtimeId of seatShowtimeIds) {
      const showtimeDetail =
        await this.showtimeContract.getSeatShowtimeDetail(seatShowtimeId);
      if (!showtimeDetail) {
        throw new BadRequestException(
          `Không tìm thấy thông tin suất chiếu cho ghế ${seatShowtimeId}`,
        );
      }

      const randomSuffix = randomUUID()
        .replace(/-/g, '')
        .slice(0, 6)
        .toUpperCase();
      const ticketCode = `TK-${dateStr}-${randomSuffix}`;

      ticketsToCreate.push({
        orderId,
        seatShowtimeId,
        ticketCode,
        price: showtimeDetail.price ?? 0,
        ticketStatus: TicketStatus.VALID,
      });
    }

    await client.ticket.createMany({ data: ticketsToCreate });
    return this.getTicketsByOrderId(orderId, client);
  }
}
