import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/domain/types/authenticated-user.type';
import { Role } from '../auth/infra/decorators/role.decorator';
import { PrismaService } from '../infra/prisma/prisma.service';
import { UserBranchQueryService } from '../user/application/services/user-branch-query.service';
import { StatisticsService } from './statistics.service';

describe('StatisticsService', () => {
  let service: StatisticsService;
  let prisma: {
    order: { findMany: jest.Mock };
    seatOrder: { findMany: jest.Mock };
    productOrder: { findMany: jest.Mock };
    item: { findMany: jest.Mock };
    combo: { findMany: jest.Mock };
  };
  let userBranches: { getBranchIdOfUser: jest.Mock };

  const adminUser: AuthenticatedUser = {
    userId: 'admin-1',
    email: 'admin@test.com',
    role: Role.ADMIN,
  };
  const managerUser: AuthenticatedUser = {
    userId: 'mgr-1',
    email: 'mgr@test.com',
    role: Role.BRANCHMANAGER,
  };

  beforeEach(() => {
    prisma = {
      order: { findMany: jest.fn() },
      seatOrder: { findMany: jest.fn() },
      productOrder: { findMany: jest.fn() },
      item: { findMany: jest.fn() },
      combo: { findMany: jest.fn() },
    };
    userBranches = {
      getBranchIdOfUser: jest.fn(),
    };
    service = new StatisticsService(
      prisma as unknown as PrismaService,
      userBranches as unknown as UserBranchQueryService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('resolveBranch & dateRange validation', () => {
    it('throws NotFoundException when branch manager is not assigned to a branch', async () => {
      userBranches.getBranchIdOfUser.mockResolvedValue(null);

      await expect(service.getFinancial(managerUser, {})).rejects.toThrow(
        NotFoundException,
      );
      expect(userBranches.getBranchIdOfUser).toHaveBeenCalledWith('mgr-1');
    });

    it('throws BadRequestException for invalid calendar dates', async () => {
      await expect(
        service.getFinancial(adminUser, { date: '2026-02-30' }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.getFinancial(adminUser, { date: 'invalid-date' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('uses current Vietnam date and day period by default when query is empty', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-01T18:00:00Z')); // 2026-11-02 VN
      prisma.order.findMany.mockResolvedValue([]);

      const res = await service.getFinancial(adminUser, {});

      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: {
          status: OrderStatus.PAID,
          createdAt: {
            gte: new Date('2026-11-01T17:00:00.000Z'),
            lt: new Date('2026-11-02T17:00:00.000Z'),
          },
        },
        select: { id: true },
      });
      expect(res).toEqual({
        date: '2026-11-02',
        period: 'day',
        branchId: null,
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
      });
    });

    it('computes Monday-Sunday range for week period including Sunday input', async () => {
      prisma.order.findMany.mockResolvedValue([]);

      const res = await service.getFinancial(adminUser, {
        date: '2026-11-01',
        period: 'week',
        branchId: 'branch-1',
      });

      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: {
          status: OrderStatus.PAID,
          branchId: 'branch-1',
          createdAt: {
            gte: new Date('2026-10-25T17:00:00.000Z'),
            lt: new Date('2026-11-01T17:00:00.000Z'),
          },
        },
        select: { id: true },
      });
      expect(res.branchId).toBe('branch-1');
      expect(res.period).toBe('week');
    });

    it('computes full month range for month period and scopes to manager branch', async () => {
      userBranches.getBranchIdOfUser.mockResolvedValue('branch-mgr');
      prisma.order.findMany.mockResolvedValue([]);

      const res = await service.getFinancial(managerUser, {
        date: '2026-02-15',
        period: 'month',
        branchId: 'ignored-branch',
      });

      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: {
          status: OrderStatus.PAID,
          branchId: 'branch-mgr',
          createdAt: {
            gte: new Date('2026-01-31T17:00:00.000Z'),
            lt: new Date('2026-02-28T17:00:00.000Z'),
          },
        },
        select: { id: true },
      });
      expect(res.branchId).toBe('branch-mgr');
    });
  });

  describe('getFinancial aggregations', () => {
    it('aggregates tickets, movies, items, combos, unknown products, and categories with sorting', async () => {
      prisma.order.findMany.mockResolvedValue([
        { id: 'ord-1' },
        { id: 'ord-2' },
      ]);
      prisma.seatOrder.findMany.mockResolvedValue([
        {
          price: 100000,
          seatShowtime: {
            showtime: { movie: { id: 'm-1', movieName: 'Beta' } },
          },
        },
        {
          price: 100000,
          seatShowtime: {
            showtime: { movie: { id: 'm-2', movieName: 'Alpha' } },
          },
        },
        {
          price: 120000,
          seatShowtime: {
            showtime: { movie: { id: 'm-2', movieName: 'Alpha' } },
          },
        },
        {
          price: 90000,
          seatShowtime: {
            showtime: { movie: { id: 'm-3', movieName: 'Gamma' } },
          },
        },
        {
          price: 80000,
          seatShowtime: null,
        },
      ]);
      prisma.productOrder.findMany.mockResolvedValue([
        { productId: 'item-1', quantity: 2, unitPrice: 50000 },
        { productId: 'item-1', quantity: 1, unitPrice: 50000 },
        { productId: 'item-2', quantity: 3, unitPrice: 50000 },
        { productId: 'combo-1', quantity: 1, unitPrice: 120000 },
        { productId: 'deleted-prod', quantity: 2, unitPrice: 20000 },
      ]);
      prisma.item.findMany.mockResolvedValue([
        { id: 'item-1', name: 'Zebra Popcorn', category: 'POPCORN' },
        { id: 'item-2', name: 'Apple Soda', category: 'BEVERAGE' },
      ]);
      prisma.combo.findMany.mockResolvedValue([
        { id: 'combo-1', name: 'Combo Couple' },
      ]);

      const res = await service.getFinancial(adminUser, {
        date: '2026-11-01',
        period: 'day',
      });

      expect(res.totalTicketsSold).toBe(5);
      expect(res.totalTicketRevenue).toBe(490000);
      expect(res.totalProductsSold).toBe(9);
      expect(res.totalProductRevenue).toBe(460000);

      expect(res.products).toEqual([
        {
          productId: 'item-2',
          productName: 'Apple Soda',
          category: 'BEVERAGE',
          quantitySold: 3,
          revenue: 150000,
        },
        {
          productId: 'item-1',
          productName: 'Zebra Popcorn',
          category: 'POPCORN',
          quantitySold: 3,
          revenue: 150000,
        },
        {
          productId: 'combo-1',
          productName: 'Combo Couple',
          category: 'COMBO',
          quantitySold: 1,
          revenue: 120000,
        },
        {
          productId: 'deleted-prod',
          productName: 'deleted-prod',
          category: 'OTHER',
          quantitySold: 2,
          revenue: 40000,
        },
      ]);

      expect(res.productsByCategory).toEqual([
        { category: 'BEVERAGE', quantitySold: 3, revenue: 150000 },
        { category: 'POPCORN', quantitySold: 3, revenue: 150000 },
        { category: 'COMBO', quantitySold: 1, revenue: 120000 },
        { category: 'OTHER', quantitySold: 2, revenue: 40000 },
      ]);

      expect(res.movies).toEqual([
        {
          movieId: 'm-2',
          movieName: 'Alpha',
          ticketsSold: 2,
          ticketRevenue: 220000,
        },
        {
          movieId: 'm-1',
          movieName: 'Beta',
          ticketsSold: 1,
          ticketRevenue: 100000,
        },
        {
          movieId: 'm-3',
          movieName: 'Gamma',
          ticketsSold: 1,
          ticketRevenue: 90000,
        },
        {
          movieId: 'UNKNOWN',
          movieName: 'Phim chưa xác định',
          ticketsSold: 1,
          ticketRevenue: 80000,
        },
      ]);
      expect(res.topSellingMovie).toEqual(res.movies[0]);
      expect(res.lowestSellingMovie).toEqual(res.movies[3]);
      expect(res.dailyShowtimeChart).toEqual(res.movies);
    });

    it('returns null topSellingMovie and lowestSellingMovie when paid orders have no seat orders', async () => {
      prisma.order.findMany.mockResolvedValue([{ id: 'ord-1' }]);
      prisma.seatOrder.findMany.mockResolvedValue([]);
      prisma.productOrder.findMany.mockResolvedValue([
        { productId: 'item-1', quantity: 1, unitPrice: 50000 },
      ]);
      prisma.item.findMany.mockResolvedValue([
        { id: 'item-1', name: 'Popcorn', category: 'POPCORN' },
      ]);
      prisma.combo.findMany.mockResolvedValue([]);

      const res = await service.getFinancial(adminUser, { date: '2026-11-01' });

      expect(res.movies).toEqual([]);
      expect(res.topSellingMovie).toBeNull();
      expect(res.lowestSellingMovie).toBeNull();
      expect(res.totalProductRevenue).toBe(50000);
    });
  });
});
