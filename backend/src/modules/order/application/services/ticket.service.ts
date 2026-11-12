import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { TicketStatus } from '../../domain/enums/ticket-status.enum';
import { TicketScannedEvent } from '../../domain/events/ticket-scanned.event';
import { Role } from '../../../auth/infra/decorators/role.decorator';
import { ShowtimeBookingService } from '../../../showtime/application/services/showtime-booking.service';
import {
  INTERNAL_EVENT_BUS,
  InternalEventBus,
} from '../../../infra/event/application/internal-event-bus.interface';
import { ScanTicketReq, StaffScanContextReq } from '../dto/req.dto';
import {
  ScanTicketResultRes,
  TicketDetailRes,
  TicketItemSummaryRes,
} from '../dto/res.dto';

@Injectable()
export class TicketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly showtimeBookingService: ShowtimeBookingService,
    @Inject(INTERNAL_EVENT_BUS)
    private readonly internalEventBus: InternalEventBus,
  ) {}

  async scanTicket(
    staffContextOrReq: StaffScanContextReq | ScanTicketReq,
    reqOrStaffContext?: ScanTicketReq | StaffScanContextReq,
  ): Promise<ScanTicketResultRes> {
    let staffContext: StaffScanContextReq;
    let dto: ScanTicketReq;

    if ('ticketCode' in staffContextOrReq) {
      dto = staffContextOrReq;
      staffContext = reqOrStaffContext as StaffScanContextReq;
    } else {
      staffContext = staffContextOrReq;
      dto = reqOrStaffContext as ScanTicketReq;
    }

    const normalizedCode = (dto?.ticketCode || '').trim();
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

    const showtimeDetail =
      await this.showtimeBookingService.getSeatShowtimeDetail(
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

    await this.internalEventBus.publish(
      new TicketScannedEvent(
        updated.id,
        updated.ticketCode,
        updated.orderId,
        showtimeDetail.showtimeId,
        showtimeDetail.branchId,
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

    const showtimeDetail =
      await this.showtimeBookingService.getSeatShowtimeDetail(
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

  async createTicketsForOrder(
    orderIdOrParams:
      | string
      | {
          orderId: string;
          seatShowtimeIds?: string[];
          items?: Array<{ seatShowtimeId: string; price?: number }>;
        },
    itemsOrTx?: Array<{ seatShowtimeId: string; price?: number }> | any,
    prismaTx?: any,
  ): Promise<TicketItemSummaryRes[]> {
    let orderId: string;
    let seatShowtimeIds: string[] = [];
    const priceMap = new Map<string, number>();
    let client: any;

    if (typeof orderIdOrParams === 'string') {
      orderId = orderIdOrParams;
      if (Array.isArray(itemsOrTx)) {
        seatShowtimeIds = itemsOrTx.map((item) => {
          if (item.price !== undefined) {
            priceMap.set(item.seatShowtimeId, item.price);
          }
          return item.seatShowtimeId;
        });
      }
      client = prismaTx ?? this.prisma;
    } else {
      orderId = orderIdOrParams.orderId;
      if (orderIdOrParams.seatShowtimeIds) {
        seatShowtimeIds = orderIdOrParams.seatShowtimeIds;
      } else if (orderIdOrParams.items) {
        seatShowtimeIds = orderIdOrParams.items.map((item) => {
          if (item.price !== undefined) {
            priceMap.set(item.seatShowtimeId, item.price);
          }
          return item.seatShowtimeId;
        });
      }
      client = itemsOrTx ?? this.prisma;
    }

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
        await this.showtimeBookingService.getSeatShowtimeDetail(seatShowtimeId);
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
        price: priceMap.get(seatShowtimeId) ?? showtimeDetail.price ?? 0,
        ticketStatus: TicketStatus.VALID,
      });
    }

    await client.ticket.createMany({ data: ticketsToCreate });
    return this.getTicketsByOrderId(orderId, client);
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
      const showtimeDetail =
        await this.showtimeBookingService.getSeatShowtimeDetail(
          ticket.seatShowtimeId,
        );
      const seatLabel = showtimeDetail
        ? `${showtimeDetail.rowPosition || ''}${showtimeDetail.columnPosition || ''}`
        : '';

      results.push(
        TicketItemSummaryRes.of(
          ticket.id,
          ticket.ticketCode,
          ticket.price,
          ticket.ticketStatus,
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
        ),
      );
    }

    return results;
  }
}
