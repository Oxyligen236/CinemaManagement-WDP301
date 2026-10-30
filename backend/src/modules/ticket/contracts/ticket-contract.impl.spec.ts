import { TicketContractImpl } from './ticket-contract.impl';
import { TicketService } from '../application/services/ticket.service';

describe('TicketContractImpl', () => {
  let contract: TicketContractImpl;
  let mockTicketService: {
    getTicketsByOrderId: jest.Mock;
    createTicketsForOrder: jest.Mock;
  };

  beforeEach(() => {
    mockTicketService = {
      getTicketsByOrderId: jest.fn(),
      createTicketsForOrder: jest.fn(),
    };
    contract = new TicketContractImpl(
      mockTicketService as unknown as TicketService,
    );
  });

  it('lấy danh sách vé theo orderId', async () => {
    const mockTickets = [
      {
        ticketId: 't-1',
        ticketCode: 'TCK-001',
        price: 90000,
        ticketStatus: 'VALID',
        seatShowtimeId: 'sst-1',
        movieTitle: 'Conan',
        roomName: 'Room 1',
        seatLabel: 'A1',
        startTime: new Date(),
        endTime: new Date(),
      },
    ];
    mockTicketService.getTicketsByOrderId.mockResolvedValue(mockTickets);

    const result = await contract.getTicketsByOrderId('ord-1');
    expect(result).toHaveLength(1);
    expect(result[0].ticketCode).toBe('TCK-001');
  });

  it('tạo vé cho order', async () => {
    mockTicketService.createTicketsForOrder.mockResolvedValue([]);
    await contract.createTicketsForOrder({
      orderId: 'ord-1',
      seatShowtimeIds: ['sst-1'],
    });
    expect(mockTicketService.createTicketsForOrder).toHaveBeenCalledWith(
      {
        orderId: 'ord-1',
        seatShowtimeIds: ['sst-1'],
      },
      undefined,
    );
  });

  it('tạo vé cho order có session', async () => {
    mockTicketService.createTicketsForOrder.mockResolvedValue([]);
    const fakeSession = {} as any;
    await contract.createTicketsForOrder(
      {
        orderId: 'ord-1',
        seatShowtimeIds: ['sst-1'],
      },
      fakeSession,
    );
    expect(mockTicketService.createTicketsForOrder).toHaveBeenCalledWith(
      {
        orderId: 'ord-1',
        seatShowtimeIds: ['sst-1'],
      },
      fakeSession,
    );
  });
});
