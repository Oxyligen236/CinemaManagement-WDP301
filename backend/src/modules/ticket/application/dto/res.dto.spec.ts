import { TicketStatus } from '../../domain/enums/ticket-status.enum';
import { ScanTicketResultRes, TicketDetailRes } from './res.dto';

describe('Ticket Module Response DTOs', () => {
  const sampleDate = new Date('2026-10-21T10:00:00.000Z');
  const usedDate = new Date('2026-10-21T11:00:00.000Z');

  const rawPlain = {
    ticketId: 'tck-1',
    orderId: 'ord-1',
    ticketCode: 'TCK-20261021-001',
    price: 75000,
    ticketStatus: TicketStatus.VALID,
    usedAt: usedDate,
    seatShowtimeId: 'sst-1',
    movieTitle: 'Avengers',
    roomName: 'Hall 1',
    seatLabel: 'A1',
    startTime: sampleDate,
    endTime: usedDate,
  };

  describe('TicketDetailRes', () => {
    it('maps correctly from a plain object', () => {
      const res = TicketDetailRes.of(rawPlain);
      expect(res).toBeInstanceOf(TicketDetailRes);
      expect(res.ticketId).toBe('tck-1');
      expect(res.orderId).toBe('ord-1');
      expect(res.ticketCode).toBe('TCK-20261021-001');
      expect(res.price).toBe(75000);
      expect(res.ticketStatus).toBe(TicketStatus.VALID);
      expect(res.usedAt).toEqual(usedDate);
      expect(res.seatShowtimeId).toBe('sst-1');
      expect(res.movieTitle).toBe('Avengers');
      expect(res.roomName).toBe('Hall 1');
      expect(res.seatLabel).toBe('A1');
      expect(res.startTime).toEqual(sampleDate);
      expect(res.endTime).toEqual(usedDate);
    });

    it('maps correctly from a simulated Mongoose document with _doc', () => {
      const mongooseDoc = {
        _doc: rawPlain,
      };
      const res = TicketDetailRes.of(mongooseDoc as any);
      expect(res).toBeInstanceOf(TicketDetailRes);
      expect(res.ticketId).toBe('tck-1');
      expect(res.orderId).toBe('ord-1');
    });

    it('maps an array via ofArray()', () => {
      const list = [rawPlain, { ...rawPlain, ticketId: 'tck-2' }];
      const resList = TicketDetailRes.ofArray(list);
      expect(resList).toHaveLength(2);
      expect(resList[0]).toBeInstanceOf(TicketDetailRes);
      expect(resList[1].ticketId).toBe('tck-2');
    });

    it('returns empty array when input is empty or nil', () => {
      expect(TicketDetailRes.ofArray([])).toEqual([]);
      expect(TicketDetailRes.ofArray(null as any)).toEqual([]);
      expect(TicketDetailRes.ofArray(undefined as any)).toEqual([]);
    });
  });

  describe('ScanTicketResultRes', () => {
    it('maps correctly with scan metadata', () => {
      const scanRaw = {
        ...rawPlain,
        scannedBy: 'staff-123',
        scannedAt: sampleDate,
        message: 'Soat ve thanh cong',
      };

      const res = ScanTicketResultRes.of(scanRaw);
      expect(res).toBeInstanceOf(ScanTicketResultRes);
      expect(res).toBeInstanceOf(TicketDetailRes);
      expect(res.ticketId).toBe('tck-1');
      expect(res.scannedBy).toBe('staff-123');
      expect(res.message).toBe('Soat ve thanh cong');
    });
  });
});
