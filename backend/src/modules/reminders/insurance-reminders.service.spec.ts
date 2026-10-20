import {
  InsuranceRemindersService,
  stageFor,
  todayInIndia,
} from './insurance-reminders.service';

describe('stageFor', () => {
  it.each([
    [31, null],
    [30, 30],
    [20, 30],
    [8, 30],
    [7, 7],
    [2, 7],
    [1, 1],
    [0, 1],
    [-1, null],
  ])('%i days left -> stage %p', (daysLeft, stage) => {
    expect(stageFor(daysLeft)).toBe(stage);
  });
});

describe('todayInIndia', () => {
  it("uses India's calendar date, not UTC's", () => {
    // 20:00 UTC on the 20th is already 01:30 on the 21st in India.
    expect(todayInIndia(new Date('2026-10-20T20:00:00Z'))).toEqual(
      new Date('2026-10-21T00:00:00Z'),
    );
  });
});

describe('InsuranceRemindersService', () => {
  const NOW = new Date('2026-10-20T03:30:00Z'); // 09:00 IST
  let service: InsuranceRemindersService;
  let prisma: {
    car: { findMany: jest.Mock };
    sentReminder: { create: jest.Mock; delete: jest.Mock };
    expense: { findFirst: jest.Mock };
  };
  let mail: { send: jest.Mock; appUrl: string };

  const carExpiringOn = (date: string) => ({
    id: 'car-1',
    make: 'Hyundai',
    model: 'Creta',
    year: 2022,
    variant: 'SX(O)',
    fuelType: 'Petrol',
    insuranceExpiryDate: new Date(date),
    user: {
      email: 'owner@example.com',
      username: 'owner',
      displayName: 'Owner Name',
      avatarUrl: null,
    },
  });

  beforeEach(() => {
    prisma = {
      car: { findMany: jest.fn() },
      sentReminder: {
        create: jest.fn().mockResolvedValue({ id: 'claim-1' }),
        delete: jest.fn(),
      },
      expense: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    mail = {
      send: jest.fn().mockResolvedValue(true),
      appUrl: 'https://glovebox.example',
    };
    service = new InsuranceRemindersService(prisma as any, mail as any);
  });

  it('only looks at cars expiring within the reminder window', async () => {
    prisma.car.findMany.mockResolvedValue([]);

    await service.sendDueReminders(NOW);

    expect(prisma.car.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          insuranceExpiryDate: {
            gte: new Date('2026-10-20T00:00:00Z'),
            lt: new Date('2026-11-20T00:00:00Z'),
          },
        },
      }),
    );
  });

  it('claims the stage, then sends the reminder with the last premium', async () => {
    prisma.car.findMany.mockResolvedValue([carExpiringOn('2026-10-27')]);
    prisma.expense.findFirst.mockResolvedValue({
      amount: '14750.00',
      currency: 'INR',
      expenseDate: new Date('2025-10-27'),
    });

    const result = await service.sendDueReminders(NOW);

    expect(result).toEqual({ sent: 1 });
    expect(prisma.sentReminder.create).toHaveBeenCalledWith({
      data: {
        carId: 'car-1',
        kind: 'INSURANCE_EXPIRY',
        dueDate: new Date('2026-10-27T00:00:00Z'),
        stage: 7,
      },
    });
    expect(mail.send).toHaveBeenCalledWith(
      'owner@example.com',
      expect.objectContaining({
        subject: "7 days left on your Creta's insurance",
        html: expect.stringContaining('₹14,750'),
      }),
    );
    expect(prisma.sentReminder.delete).not.toHaveBeenCalled();
  });

  it('skips a stage that was already sent', async () => {
    prisma.car.findMany.mockResolvedValue([carExpiringOn('2026-10-27')]);
    prisma.sentReminder.create.mockRejectedValue(
      Object.assign(new Error('duplicate'), { code: 'P2002' }),
    );

    const result = await service.sendDueReminders(NOW);

    expect(result).toEqual({ sent: 0 });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('releases the claim when the email fails so tomorrow retries', async () => {
    prisma.car.findMany.mockResolvedValue([carExpiringOn('2026-10-21')]);
    mail.send.mockResolvedValue(false);

    const result = await service.sendDueReminders(NOW);

    expect(result).toEqual({ sent: 0 });
    expect(prisma.sentReminder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ stage: 1 }),
    });
    expect(prisma.sentReminder.delete).toHaveBeenCalledWith({
      where: { id: 'claim-1' },
    });
  });

  it('keeps going when one car fails', async () => {
    prisma.car.findMany.mockResolvedValue([
      { ...carExpiringOn('2026-10-27'), id: 'bad-car' },
      carExpiringOn('2026-11-19'),
    ]);
    prisma.sentReminder.create
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockResolvedValueOnce({ id: 'claim-2' });

    const result = await service.sendDueReminders(NOW);

    expect(result).toEqual({ sent: 1 });
    expect(mail.send).toHaveBeenCalledWith(
      'owner@example.com',
      expect.objectContaining({
        subject: "Your Creta's insurance ends in 30 days",
      }),
    );
  });
});
