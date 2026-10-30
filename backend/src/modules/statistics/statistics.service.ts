import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthenticatedUser } from '../auth/domain/types/authenticated-user.type';
import { Role } from '../auth/infra/decorators/role.decorator';
import { UserBranchQueryService } from '../user/application/services/user-branch-query.service';
import { Order, OrderDocument } from '../order/domain/schemas/order.schema';
import {
  SeatOrder,
  SeatOrderDocument,
} from '../order/domain/schemas/seat-order.schema';
import {
  ProductOrder,
  ProductOrderDocument,
} from '../order/domain/schemas/product-order.schema';
import {
  Showtime,
  ShowtimeDocument,
} from '../showtime/domain/schemas/showtime.schema';
import { Item, ItemDocument } from '../product/domain/schemas/item.schema';
import { Combo, ComboDocument } from '../product/domain/schemas/combo.schema';
import { FinancialStatisticsQueryDto } from './statistics.dto';

const PAID = 'PAID';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectModel(Order.name) private readonly orders: Model<OrderDocument>,
    @InjectModel(SeatOrder.name)
    private readonly seatOrders: Model<SeatOrderDocument>,
    @InjectModel(ProductOrder.name)
    private readonly productOrders: Model<ProductOrderDocument>,
    @InjectModel(Showtime.name)
    private readonly showtimes: Model<ShowtimeDocument>,
    @InjectModel(Item.name) private readonly items: Model<ItemDocument>,
    @InjectModel(Combo.name) private readonly combos: Model<ComboDocument>,
    private readonly userBranches: UserBranchQueryService,
  ) {}

  async getFinancial(
    user: AuthenticatedUser,
    query: FinancialStatisticsQueryDto,
  ) {
    const branchId = await this.resolveBranch(user, query.branchId);
    const { start, end, date } = this.dayRange(query.date);
    const paidOrders = {
      status: PAID,
      ...(branchId ? { branchId } : {}),
      createdAt: { $gte: start, $lt: end },
    };
    const orderLookup = [
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: 'orderId',
          as: 'order',
        },
      },
      { $unwind: '$order' },
      {
        $match: Object.fromEntries(
          Object.entries(paidOrders).map(([key, value]) => [
            `order.${key}`,
            value,
          ]),
        ),
      },
    ];

    const [ticketTotal, productTotal, products, movies, chart] =
      await Promise.all([
        this.seatOrders.aggregate([
          ...orderLookup,
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              revenue: { $sum: '$price' },
            },
          },
        ]),
        this.productOrders.aggregate([
          ...orderLookup,
          { $group: { _id: null, total: { $sum: '$quantity' } } },
        ]),
        this.productStatistics(orderLookup),
        this.seatOrders.aggregate([
          ...orderLookup,
          {
            $lookup: {
              from: 'seat_showtimes',
              localField: 'seatShowtimeId',
              foreignField: 'seatShowtimeId',
              as: 'seat',
            },
          },
          { $unwind: '$seat' },
          {
            $lookup: {
              from: 'showtimes',
              localField: 'seat.showtimeId',
              foreignField: 'showtimeId',
              as: 'showtime',
            },
          },
          { $unwind: '$showtime' },
          {
            $lookup: {
              from: 'movies',
              localField: 'showtime.movieId',
              foreignField: 'movieId',
              as: 'movie',
            },
          },
          { $unwind: '$movie' },
          {
            $group: {
              _id: '$movie.movieId',
              movieName: { $first: '$movie.movieName' },
              ticketsSold: { $sum: 1 },
              ticketRevenue: { $sum: '$price' },
            },
          },
        ]),
        this.dailyChart(branchId, start, end),
      ]);
    const sorted = movies.sort(
      (a, b) =>
        b.ticketsSold - a.ticketsSold || a.movieName.localeCompare(b.movieName),
    );
    const productRevenue = products.reduce(
      (total, product) => total + product.revenue,
      0,
    );
    const productsByCategory = Object.values(
      products.reduce<
        Record<
          string,
          { category: string; quantitySold: number; revenue: number }
        >
      >((result, product) => {
        const entry = result[product.category] ?? {
          category: product.category,
          quantitySold: 0,
          revenue: 0,
        };
        entry.quantitySold += product.quantitySold;
        entry.revenue += product.revenue;
        result[product.category] = entry;
        return result;
      }, {}),
    );
    return {
      date,
      branchId: branchId ?? null,
      totalTicketsSold: ticketTotal[0]?.total ?? 0,
      totalTicketRevenue: ticketTotal[0]?.revenue ?? 0,
      totalProductsSold: productTotal[0]?.total ?? 0,
      totalProductRevenue: productRevenue,
      products,
      productsByCategory,
      topSellingMovie: sorted[0] ?? null,
      lowestSellingMovie: sorted.at(-1) ?? null,
      dailyShowtimeChart: chart,
    };
  }

  private async resolveBranch(user: AuthenticatedUser, requested?: string) {
    if (user.role === Role.ADMIN) return requested || undefined;
    const branchId = await this.userBranches.getBranchIdOfUser(user.userId);
    if (!branchId)
      throw new NotFoundException('Tài khoản quản lý chưa được gán chi nhánh.');
    return branchId;
  }

  private dayRange(input?: string) {
    const date = input ?? new Date().toISOString().slice(0, 10);
    const [year, month, day] = date.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, day) - 7 * 60 * 60 * 1000);
    if (Number.isNaN(start.getTime()))
      throw new BadRequestException('Ngày không hợp lệ.');
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end, date };
  }

  private async productStatistics(orderLookup: any[]) {
    return this.productOrders.aggregate([
      ...orderLookup,
      {
        $lookup: {
          from: 'items',
          localField: 'productId',
          foreignField: 'itemId',
          as: 'item',
        },
      },
      {
        $lookup: {
          from: 'combos',
          localField: 'productId',
          foreignField: 'comboId',
          as: 'combo',
        },
      },
      {
        $project: {
          productId: 1,
          quantity: 1,
          revenue: { $multiply: ['$quantity', '$unitPrice'] },
          productName: {
            $ifNull: [
              { $arrayElemAt: ['$item.name', 0] },
              { $ifNull: [{ $arrayElemAt: ['$combo.name', 0] }, '$productId'] },
            ],
          },
          category: {
            $ifNull: [
              { $arrayElemAt: ['$item.category', 0] },
              { $cond: [{ $gt: [{ $size: '$combo' }, 0] }, 'COMBO', 'OTHER'] },
            ],
          },
        },
      },
      {
        $group: {
          _id: {
            productId: '$productId',
            productName: '$productName',
            category: '$category',
          },
          quantitySold: { $sum: '$quantity' },
          revenue: { $sum: '$revenue' },
        },
      },
      {
        $project: {
          _id: 0,
          productId: '$_id.productId',
          productName: '$_id.productName',
          category: '$_id.category',
          quantitySold: 1,
          revenue: 1,
        },
      },
      { $sort: { revenue: -1, productName: 1 } },
    ]);
  }

  private async dailyChart(
    branchId: string | undefined,
    start: Date,
    end: Date,
  ) {
    return this.showtimes.aggregate([
      { $match: { startTime: { $gte: start, $lt: end } } },
      {
        $lookup: {
          from: 'rooms',
          localField: 'roomId',
          foreignField: 'roomId',
          as: 'room',
        },
      },
      { $unwind: '$room' },
      ...(branchId ? [{ $match: { 'room.branchId': branchId } }] : []),
      {
        $lookup: {
          from: 'seat_showtimes',
          localField: 'showtimeId',
          foreignField: 'showtimeId',
          as: 'seats',
        },
      },
      { $unwind: { path: '$seats', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'seat_orders',
          localField: 'seats.seatShowtimeId',
          foreignField: 'seatShowtimeId',
          as: 'seatOrder',
        },
      },
      { $unwind: { path: '$seatOrder', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'orders',
          localField: 'seatOrder.orderId',
          foreignField: 'orderId',
          as: 'order',
        },
      },
      { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'movies',
          localField: 'movieId',
          foreignField: 'movieId',
          as: 'movie',
        },
      },
      { $unwind: '$movie' },
      {
        $group: {
          _id: { movieId: '$movieId', showtimeId: '$showtimeId' },
          movieName: { $first: '$movie.movieName' },
          ticketsSold: {
            $sum: { $cond: [{ $eq: ['$order.status', PAID] }, 1, 0] },
          },
          ticketRevenue: {
            $sum: {
              $cond: [{ $eq: ['$order.status', PAID] }, '$seatOrder.price', 0],
            },
          },
        },
      },
      {
        $group: {
          _id: '$_id.movieId',
          movieName: { $first: '$movieName' },
          showtimeCount: { $sum: 1 },
          ticketsSold: { $sum: '$ticketsSold' },
          ticketRevenue: { $sum: '$ticketRevenue' },
        },
      },
      {
        $project: {
          _id: 0,
          movieId: '$_id',
          movieName: 1,
          showtimeCount: 1,
          ticketsSold: 1,
          ticketRevenue: 1,
        },
      },
      { $sort: { ticketsSold: -1, movieName: 1 } },
    ]);
  }
}
