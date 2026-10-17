import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class PageRequest {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 10;
}

export class Page<T> extends PageRequest {
  items!: T[];
  total!: number;
  totalPages!: number;

  static from<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
  ): Page<T> {
    const pageDto = new Page<T>();
    pageDto.items = items;
    pageDto.total = total;
    pageDto.page = page;
    pageDto.limit = limit;
    pageDto.totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
    return pageDto;
  }
}
