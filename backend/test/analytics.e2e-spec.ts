import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

describe('Analytics (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userAToken: string;
  let userBToken: string;
  let carAId: string;
  let carBId: string;
  let jwt: JwtService;
  let jwtSecret: string;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(
      new AllExceptionsFilter(),
      new PrismaExceptionFilter(),
    );
    await app.init();

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    const config = app.get(ConfigService);
    jwtSecret = config.getOrThrow<string>('jwt.secret');
    const secret = jwtSecret;

    const userA = await prisma.user.create({
      data: {
        googleId: `an-e2e-a-${Date.now()}`,
        email: `an-e2e-a-${Date.now()}@example.com`,
        username: `ane2ea${Date.now()}`,
      },
    });
    const userB = await prisma.user.create({
      data: {
        googleId: `an-e2e-b-${Date.now()}`,
        email: `an-e2e-b-${Date.now()}@example.com`,
        username: `ane2eb${Date.now()}`,
      },
    });
    createdUserIds.push(userA.id, userB.id);
    userAToken = jwt.sign({ sub: userA.id }, { secret, expiresIn: '15m' });
    userBToken = jwt.sign({ sub: userB.id }, { secret, expiresIn: '15m' });

    const carBase = {
      make: 'Honda',
      model: 'Civic',
      year: 2020,
      variant: 'VTi-L',
      engine: '1.8L i-VTEC',
      fuelType: 'Petrol',
      transmission: 'CVT',
      bodyType: 'Sedan',
      odometerKm: 40500,
    };

    const carA = await prisma.car.create({
      data: { ...carBase, userId: userA.id },
    });
    carAId = carA.id;
    const carB = await prisma.car.create({
      data: { ...carBase, model: 'City', userId: userB.id },
    });
    carBId = carB.id;

    // Hand-computed fixture for User A's car:
    //   FUEL:    2000 (odometer 40000) + 1000 (odometer 40500) = 3000
    //   SERVICE: 1500 (no odometer)
    //   total = 4500, trackedKm = 40500 - 40000 = 500, costPerKm = 4500 / 500 = 9
    //   both expenses land in August 2026 -> monthlySpend = [{ month: '2026-08', total: 4500 }]
    await prisma.expense.create({
      data: {
        carId: carAId,
        category: 'FUEL',
        amount: '2000.00',
        expenseDate: new Date('2026-08-01'),
        odometerKm: 40000,
      },
    });
    await prisma.expense.create({
      data: {
        carId: carAId,
        category: 'FUEL',
        amount: '1000.00',
        expenseDate: new Date('2026-08-10'),
        odometerKm: 40500,
      },
    });
    await prisma.expense.create({
      data: {
        carId: carAId,
        category: 'SERVICE',
        amount: '1500.00',
        expenseDate: new Date('2026-08-15'),
      },
    });

    // User B's car has its own, unrelated expense — used to prove isolation.
    await prisma.expense.create({
      data: {
        carId: carBId,
        category: 'REPAIR',
        amount: '9999.00',
        expenseDate: new Date('2026-08-01'),
      },
    });
  });

  afterAll(async () => {
    await prisma.expense.deleteMany({
      where: { car: { userId: { in: createdUserIds } } },
    });
    await prisma.car.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  function asUserA() {
    return { Cookie: [`access_token=${userAToken}`] };
  }
  function asUserB() {
    return { Cookie: [`access_token=${userBToken}`] };
  }

  it('rejects analytics routes with no auth cookie', async () => {
    await request(app.getHttpServer()).get('/analytics/garage').expect(401);
    await request(app.getHttpServer())
      .get(`/analytics/cars/${carAId}`)
      .expect(401);
  });

  it("User B cannot fetch User A's per-car analytics", () => {
    return request(app.getHttpServer())
      .get(`/analytics/cars/${carAId}`)
      .set(asUserB())
      .expect(404);
  });

  it('computes per-car analytics matching the hand-calculated fixture exactly', async () => {
    const res = await request(app.getHttpServer())
      .get(`/analytics/cars/${carAId}`)
      .set(asUserA())
      .expect(200);

    expect(res.body.totalSpend).toBe(4500);
    expect(res.body.trackedKm).toBe(500);
    expect(res.body.costPerKm).toBe(9);
    expect(res.body.spendByCategory).toEqual(
      expect.arrayContaining([
        { category: 'FUEL', total: 3000 },
        { category: 'SERVICE', total: 1500 },
      ]),
    );
    expect(res.body.monthlySpend).toEqual([{ month: '2026-08', total: 4500 }]);
  });

  it("garage analytics for User A only reflect User A's own car", async () => {
    const res = await request(app.getHttpServer())
      .get('/analytics/garage')
      .set(asUserA())
      .expect(200);

    expect(res.body.totalCars).toBe(1);
    expect(res.body.totalSpend).toBe(4500);
    expect(res.body.totalTrackedKm).toBe(500);
    expect(res.body.averageCostPerKm).toBe(9);
    expect(res.body.carComparison).toHaveLength(1);
    expect(res.body.carComparison[0]).toEqual(
      expect.objectContaining({
        carId: carAId,
        totalSpend: 4500,
        costPerKm: 9,
      }),
    );
    // User B's 9999 REPAIR expense must never leak into User A's totals.
    const total = res.body.totalSpend;
    expect(total).not.toBe(4500 + 9999);
  });

  it("garage analytics for User B only reflect User B's own car", async () => {
    const res = await request(app.getHttpServer())
      .get('/analytics/garage')
      .set(asUserB())
      .expect(200);

    expect(res.body.totalCars).toBe(1);
    expect(res.body.totalSpend).toBe(9999);
    expect(res.body.carComparison[0].carId).toBe(carBId);
  });

  it('garage analytics surface recent expenses and this-month category totals', async () => {
    const userC = await prisma.user.create({
      data: {
        googleId: `an-e2e-c-${Date.now()}`,
        email: `an-e2e-c-${Date.now()}@example.com`,
        username: `ane2ec${Date.now()}`,
      },
    });
    createdUserIds.push(userC.id);
    const userCToken = jwt.sign(
      { sub: userC.id },
      { secret: jwtSecret, expiresIn: '15m' },
    );

    const carC = await prisma.car.create({
      data: {
        make: 'Hyundai',
        model: 'Creta',
        year: 2023,
        variant: 'SX(O)',
        engine: '1.5L Diesel',
        fuelType: 'Diesel',
        transmission: 'Automatic',
        bodyType: 'SUV',
        odometerKm: 12800,
        userId: userC.id,
      },
    });

    // An old expense, well outside "this month" under any real-world clock,
    // and dated so it is never the most recent of the two.
    await prisma.expense.create({
      data: {
        carId: carC.id,
        category: 'SERVICE',
        amount: '1500.00',
        expenseDate: new Date('2020-01-15'),
      },
    });
    // Dated "today" rather than hardcoded, so this is always both the most
    // recent expense and always inside "this month", regardless of when the
    // suite runs.
    await prisma.expense.create({
      data: {
        carId: carC.id,
        category: 'FUEL',
        amount: '900.00',
        expenseDate: new Date(),
      },
    });

    const res = await request(app.getHttpServer())
      .get('/analytics/garage')
      .set({ Cookie: [`access_token=${userCToken}`] })
      .expect(200);

    expect(res.body.recentExpenses[0]).toEqual(
      expect.objectContaining({
        carId: carC.id,
        carLabel: 'Hyundai Creta',
        category: 'FUEL',
        amount: 900,
      }),
    );
    expect(res.body.currentMonthSpendByCategory).toEqual(
      expect.arrayContaining([{ category: 'FUEL', total: 900 }]),
    );
    expect(res.body.currentMonthSpendByCategory).not.toEqual(
      expect.arrayContaining([{ category: 'SERVICE', total: 1500 }]),
    );
  });
});
