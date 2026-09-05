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

describe('Expenses (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userAToken: string;
  let userBToken: string;
  let userACarId: string;
  const createdUserIds: string[] = [];

  const VALID_CAR = {
    make: 'Honda',
    model: 'Civic',
    year: 2020,
    variant: 'VTi-L',
    engine: '1.8L i-VTEC',
    fuelType: 'Petrol',
    transmission: 'CVT',
    bodyType: 'Sedan',
    odometerKm: 42000,
  };

  const VALID_EXPENSE = {
    category: 'FUEL',
    amount: 2500,
    expenseDate: '2026-08-01',
    litres: 42,
    fuelStation: 'Shell, Bavdhan',
  };

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
    const jwt = app.get(JwtService);
    const config = app.get(ConfigService);
    const secret = config.getOrThrow<string>('jwt.secret');

    const userA = await prisma.user.create({
      data: {
        googleId: `exp-e2e-a-${Date.now()}`,
        email: `exp-e2e-a-${Date.now()}@example.com`,
        username: `expe2ea${Date.now()}`,
      },
    });
    const userB = await prisma.user.create({
      data: {
        googleId: `exp-e2e-b-${Date.now()}`,
        email: `exp-e2e-b-${Date.now()}@example.com`,
        username: `expe2eb${Date.now()}`,
      },
    });
    createdUserIds.push(userA.id, userB.id);

    userAToken = jwt.sign({ sub: userA.id }, { secret, expiresIn: '15m' });
    userBToken = jwt.sign({ sub: userB.id }, { secret, expiresIn: '15m' });

    const car = await prisma.car.create({
      data: { ...VALID_CAR, userId: userA.id },
    });
    userACarId = car.id;
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

  it('rejects every expense route with no auth cookie', async () => {
    await request(app.getHttpServer())
      .get(`/cars/${userACarId}/expenses`)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/cars/${userACarId}/expenses`)
      .send(VALID_EXPENSE)
      .expect(401);
  });

  it('rejects an invalid create payload with 400', () => {
    return request(app.getHttpServer())
      .post(`/cars/${userACarId}/expenses`)
      .set(asUserA())
      .send({
        category: 'NOT_A_REAL_CATEGORY',
        amount: 100,
        expenseDate: '2026-08-01',
      })
      .expect(400);
  });

  it("User B cannot create an expense on User A's car", () => {
    return request(app.getHttpServer())
      .post(`/cars/${userACarId}/expenses`)
      .set(asUserB())
      .send(VALID_EXPENSE)
      .expect(404);
  });

  it('creates an expense with category-specific fields for the owning user', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cars/${userACarId}/expenses`)
      .set(asUserA())
      .send(VALID_EXPENSE)
      .expect(201);

    expect(res.body.category).toBe('FUEL');
    expect(res.body.fuelStation).toBe('Shell, Bavdhan');
    expect(Number(res.body.amount)).toBe(2500);
  });

  describe('cross-user isolation', () => {
    let expenseId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post(`/cars/${userACarId}/expenses`)
        .set(asUserA())
        .send(VALID_EXPENSE)
        .expect(201);
      expenseId = res.body.id;
    });

    it("User B cannot list User A's car's expenses", () => {
      return request(app.getHttpServer())
        .get(`/cars/${userACarId}/expenses`)
        .set(asUserB())
        .expect(404);
    });

    it("User B gets 404 updating User A's expense directly by id", () => {
      return request(app.getHttpServer())
        .patch(`/expenses/${expenseId}`)
        .set(asUserB())
        .send({ notes: 'hijacked' })
        .expect(404);
    });

    it("User B gets 404 deleting User A's expense directly by id", () => {
      return request(app.getHttpServer())
        .delete(`/expenses/${expenseId}`)
        .set(asUserB())
        .expect(404);
    });

    it('User A can list, update, and delete their own expense', async () => {
      const listRes = await request(app.getHttpServer())
        .get(`/cars/${userACarId}/expenses`)
        .set(asUserA())
        .expect(200);
      expect(
        listRes.body.data.some((e: { id: string }) => e.id === expenseId),
      ).toBe(true);

      const updateRes = await request(app.getHttpServer())
        .patch(`/expenses/${expenseId}`)
        .set(asUserA())
        .send({ notes: 'topped up' })
        .expect(200);
      expect(updateRes.body.notes).toBe('topped up');

      await request(app.getHttpServer())
        .delete(`/expenses/${expenseId}`)
        .set(asUserA())
        .expect(204);
    });
  });
});
