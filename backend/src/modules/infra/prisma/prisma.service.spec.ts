import { Logger } from '@nestjs/common';

const prismaClientConstructorSpy = jest.fn();
const mockConnect = jest.fn();
const mockDisconnect = jest.fn();

jest.mock('@prisma/client', () => {
  const actual =
    jest.requireActual<typeof import('@prisma/client')>('@prisma/client');
  return {
    ...actual,
    PrismaClient: class {
      $connect = mockConnect;
      $disconnect = mockDisconnect;
      constructor(options?: unknown) {
        prismaClientConstructorSpy(options);
      }
    },
  };
});

import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  const originalMongoUri = process.env.MONGODB_URI;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
    mockDisconnect.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (originalMongoUri === undefined) {
      delete process.env.MONGODB_URI;
    } else {
      process.env.MONGODB_URI = originalMongoUri;
    }
    jest.restoreAllMocks();
  });

  it('passes datasources.db.url to PrismaClient when MONGODB_URI is defined', () => {
    process.env.MONGODB_URI = 'mongodb://localhost:27017/cinema_test';

    new PrismaService();

    expect(prismaClientConstructorSpy).toHaveBeenCalledWith({
      datasources: {
        db: {
          url: 'mongodb://localhost:27017/cinema_test',
        },
      },
    });
  });

  it('passes undefined to PrismaClient when MONGODB_URI is not set', () => {
    delete process.env.MONGODB_URI;

    new PrismaService();

    expect(prismaClientConstructorSpy).toHaveBeenCalledWith(undefined);
  });

  it('connects to MongoDB and logs on onModuleInit', async () => {
    process.env.MONGODB_URI = 'mongodb://localhost:27017/cinema_test';
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const service = new PrismaService();

    await service.onModuleInit();

    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('Connected to MongoDB via Prisma');
  });

  it('disconnects from MongoDB and logs on onModuleDestroy', async () => {
    delete process.env.MONGODB_URI;
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const service = new PrismaService();

    await service.onModuleDestroy();

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('Disconnected from MongoDB');
  });
});
