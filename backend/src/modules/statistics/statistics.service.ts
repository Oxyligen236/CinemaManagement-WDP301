import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../infra/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/domain/types/authenticated-user.type';
import { Role } from '../auth/infra/decorators/role.decorator';
import { UserBranchQueryService } from '../user/application/services/user-branch-query.service';
import { OrderStatus } from '@prisma/client';
import { FinancialStatisticsQueryDto } from './statistics.dto';

@Injectable()
export class StatisticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userBranches: UserBranchQueryService,
  ) {}

  async getFinancial(user: AuthenticatedUser, query: FinancialStatisticsQueryDto) {
    const branchId = await this.resolveBranch(user, query.branchId);
    const { start, end, date, period } = this.dateRange(query.date, query.period);

    const paidOrders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PAID,
        ...(branchId ? { branchId } : {}),
        createdAt: { gte: start, lt: end },
      },
      select: { id: true },
    });

    const paidOrderIds = paidOrders.map((o) => o.id);

    if (paidOrderIds.length === 0) {
      return {
        date,
        period,
        branchId: branchId ?? null,
        totalTicketsSold: 0,
        totalTicketRevenue: 0,
        totalProductsSold: 0,
        totalProductRevenue: 0,
        products: [],
        productsByCategory: [],
        movies: [],
        topSellingMovie: null,
        lowestSellingMovie: null,
        dailyShowtimeChart: [],
      };
    }

    const [seatOrders, productOrders] = await Promise.all([
      this.prisma.seatOrder.findMany({
        where: { orderId: { in: paidOrderIds } },
        include: {
          seatShowtime: {
            include: {
              showtime: {
                include: {
                  movie: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.productOrder.findMany({
        where: { orderId: { in: paidOrderIds } },
      }),
    ]);

    const totalTicketsSold = seatOrders.length;
    const totalTicketRevenue = seatOrders.reduce((sum, s) => sum + s.price, 0);

    const totalProductsSold = productOrders.reduce((sum, p) => sum + p.quantity, 0);

    const productIds = Array.from(new Set(productOrders.map((p) => p.productId)));
    const [items, combos] = await Promise.all([
      this.prisma.item.findMany({ where: { id: { in: productIds } } }),
      this.prisma.combo.findMany({ where: { id: { in: productIds } } }),
    ]);

    const itemMap = new Map(items.map((i) => [i.id, i]));
    const comboMap = new Map(combos.map((c) => [c.id, c]));

    const productAggMap = new Map<
      string,
      { productId: string; productName: string; category: string; quantitySold: number; revenue: number }
    >();

    for (const po of productOrders) {
      const item = itemMap.get(po.productId);
      const combo = comboMap.get(po.productId);
      const productName = item?.name ?? combo?.name ?? po.productId;
      const category = item?.category ?? (combo ? 'COMBO' : 'OTHER');
      const revenue = po.quantity * po.unitPrice;

      const existing = productAggMap.get(po.productId);
      if (existing) {
        existing.quantitySold += po.quantity;
        existing.revenue += revenue;
      } else {
        productAggMap.set(po.productId, {
          productId: po.productId,
          productName,
          category,
          quantitySold: po.quantity,
          revenue,
        });
      }
    }

    const products = Array.from(productAggMap.values()).sort(
      (a, b) => b.revenue - a.revenue || a.productName.localeCompare(b.productName),
    );
    const totalProductRevenue = products.reduce((sum, p) => sum + p.revenue, 0);

    const productsByCategory = Object.values(
      products.reduce<Record<string, { category: string; quantitySold: number; revenue: number }>>(
        (result, product) => {
          const entry = result[product.category] ?? {
            category: product.category,
            quantitySold: 0,
            revenue: 0,
          };
          entry.quantitySold += product.quantitySold;
          entry.revenue += product.revenue;
          result[product.category] = entry;
          return result;
        },
        {},
      ),
    );

    const movieAggMap = new Map<
      string,
      { movieId: string; movieName: string; ticketsSold: number; ticketRevenue: number }
    >();

    for (const so of seatOrders) {
      const movie = so.seatShowtime?.showtime?.movie;
      const movieId = movie?.id ?? 'UNKNOWN';
      const movieName = movie?.movieName ?? 'Phim chưa xác định';

      const existing = movieAggMap.get(movieId);
      if (existing) {
        existing.ticketsSold += 1;
        existing.ticketRevenue += so.price;
      } else {
        movieAggMap.set(movieId, {
          movieId,
          movieName,
          ticketsSold: 1,
          ticketRevenue: so.price,
        });
      }
    }

    const movies = Array.from(movieAggMap.values()).sort(
      (a, b) => b.ticketsSold - a.ticketsSold || a.movieName.localeCompare(b.movieName),
    );

    return {
      date,
      period,
      branchId: branchId ?? null,
      totalTicketsSold,
      totalTicketRevenue,
      totalProductsSold,
      totalProductRevenue,
      products,
      productsByCategory,
      movies,
      topSellingMovie: movies[0] ?? null,
      lowestSellingMovie: movies.at(-1) ?? null,
      dailyShowtimeChart: movies,
    };
  }

  private async resolveBranch(user: AuthenticatedUser, requested?: string) {
    if (user.role === Role.ADMIN) return requested || undefined;
    const branchId = await this.userBranches.getBranchIdOfUser(user.userId);
    if (!branchId) throw new NotFoundException('Tài khoản quản lý chưa được gán chi nhánh.');
    return branchId;
  }

  private dateRange(input?: string, requestedPeriod: 'day' | 'week' | 'month' = 'day') {
    const date = input ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    const [year, month, day] = date.split('-').map(Number);
    const localStart = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(localStart.getTime()) || localStart.getUTCDate() !== day)
      throw new BadRequestException('Ngày không hợp lệ.');
    if (requestedPeriod === 'week') localStart.setUTCDate(localStart.getUTCDate() - ((localStart.getUTCDay() + 6) % 7));
    if (requestedPeriod === 'month') localStart.setUTCDate(1);
    const start = new Date(localStart.getTime() - 7 * 60 * 60 * 1000);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + (requestedPeriod === 'day' ? 1 : requestedPeriod === 'week' ? 7 : new Date(Date.UTC(localStart.getUTCFullYear(), localStart.getUTCMonth() + 1, 1)).getUTCDate()));
    if (requestedPeriod === 'month') end.setTime(Date.UTC(localStart.getUTCFullYear(), localStart.getUTCMonth() + 1, 1) - 7 * 60 * 60 * 1000);
    return { start, end, date, period: requestedPeriod };
  }
}
