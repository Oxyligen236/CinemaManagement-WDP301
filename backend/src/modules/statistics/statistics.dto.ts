import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';

export class FinancialStatisticsQueryDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  date?: string;

  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  period?: 'day' | 'week' | 'month';

  @IsOptional()
  @IsString()
  branchId?: string;
}

export class ProductFinancialStatDto {
  productId!: string;
  productName!: string;
  category!: string;
  quantitySold!: number;
  revenue!: number;

  static of(
    productId: string,
    productName: string,
    category: string,
    quantitySold: number,
    revenue: number,
  ): ProductFinancialStatDto {
    const res = new ProductFinancialStatDto();
    Object.assign(res, {
      productId,
      productName,
      category,
      quantitySold,
      revenue,
    });
    return res;
  }
}

export class CategoryFinancialStatDto {
  category!: string;
  quantitySold!: number;
  revenue!: number;

  static of(
    category: string,
    quantitySold: number,
    revenue: number,
  ): CategoryFinancialStatDto {
    const res = new CategoryFinancialStatDto();
    Object.assign(res, { category, quantitySold, revenue });
    return res;
  }
}

export class MovieFinancialStatDto {
  movieId!: string;
  movieName!: string;
  ticketsSold!: number;
  ticketRevenue!: number;

  static of(
    movieId: string,
    movieName: string,
    ticketsSold: number,
    ticketRevenue: number,
  ): MovieFinancialStatDto {
    const res = new MovieFinancialStatDto();
    Object.assign(res, { movieId, movieName, ticketsSold, ticketRevenue });
    return res;
  }
}

export class FinancialStatisticsResDto {
  date!: string;
  period!: string;
  branchId!: string | null;
  totalTicketsSold!: number;
  totalTicketRevenue!: number;
  totalProductsSold!: number;
  totalProductRevenue!: number;
  products!: ProductFinancialStatDto[];
  productsByCategory!: CategoryFinancialStatDto[];
  movies!: MovieFinancialStatDto[];
  topSellingMovie!: MovieFinancialStatDto | null;
  lowestSellingMovie!: MovieFinancialStatDto | null;
  dailyShowtimeChart!: MovieFinancialStatDto[];

  static of(params: {
    date: string;
    period: string;
    branchId: string | null;
    totalTicketsSold: number;
    totalTicketRevenue: number;
    totalProductsSold: number;
    totalProductRevenue: number;
    products: ProductFinancialStatDto[];
    productsByCategory: CategoryFinancialStatDto[];
    movies: MovieFinancialStatDto[];
    topSellingMovie: MovieFinancialStatDto | null;
    lowestSellingMovie: MovieFinancialStatDto | null;
    dailyShowtimeChart: MovieFinancialStatDto[];
  }): FinancialStatisticsResDto {
    const res = new FinancialStatisticsResDto();
    Object.assign(res, params);
    return res;
  }
}
