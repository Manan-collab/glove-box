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

describe('Cars (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userAToken: string;
  let userBToken: string;
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

    // Sequential, not Promise.all: @prisma/adapter-pg (Prisma 7) does not
    // support two concurrent queries on the same PrismaClient instance —
    // see https://github.com/prisma/prisma/issues/29407.
    const userA = await prisma.user.create({
      data: {
        googleId: `cars-e2e-a-${Date.now()}`,
        email: `cars-e2e-a-${Date.now()}@example.com`,
        username: `carse2ea${Date.now()}`,
      },
    });
    const userB = await prisma.user.create({
      data: {
        googleId: `cars-e2e-b-${Date.now()}`,
        email: `cars-e2e-b-${Date.now()}@example.com`,
        username: `carse2eb${Date.now()}`,
      },
    });
    createdUserIds.push(userA.id, userB.id);

    userAToken = jwt.sign({ sub: userA.id }, { secret, expiresIn: '15m' });
    userBToken = jwt.sign({ sub: userB.id }, { secret, expiresIn: '15m' });
  });

  afterAll(async () => {
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

  it('rejects every car route with no auth cookie', async () => {
    await request(app.getHttpServer()).get('/cars').expect(401);
    await request(app.getHttpServer())
      .post('/cars')
      .send(VALID_CAR)
      .expect(401);
  });

  it('rejects an invalid create payload with 400', () => {
    return request(app.getHttpServer())
      .post('/cars')
      .set(asUserA())
      .send({ make: 'Honda' })
      .expect(400);
  });

  it('creates a car for the authenticated user and returns it', async () => {
    const res = await request(app.getHttpServer())
      .post('/cars')
      .set(asUserA())
      .send(VALID_CAR)
      .expect(201);

    expect(res.body.make).toBe('Honda');
    expect(res.body.id).toBeDefined();
  });

  it('round-trips usageTag and insuranceExpiryDate', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/cars')
      .set(asUserA())
      .send({
        ...VALID_CAR,
        usageTag: 'Daily Driver',
        insuranceExpiryDate: '2027-01-15',
      })
      .expect(201);

    expect(createRes.body.usageTag).toBe('Daily Driver');
    expect(createRes.body.insuranceExpiryDate).toBe(
      new Date('2027-01-15').toISOString(),
    );

    const updateRes = await request(app.getHttpServer())
      .patch(`/cars/${createRes.body.id}`)
      .set(asUserA())
      .send({ usageTag: 'Weekend Car' })
      .expect(200);

    expect(updateRes.body.usageTag).toBe('Weekend Car');
    // Untouched fields survive a partial update.
    expect(updateRes.body.insuranceExpiryDate).toBe(
      new Date('2027-01-15').toISOString(),
    );
  });

  describe('cross-user isolation', () => {
    let carId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/cars')
        .set(asUserA())
        .send(VALID_CAR)
        .expect(201);
      carId = res.body.id;
    });

    it('User A sees the car in their own list', async () => {
      const res = await request(app.getHttpServer())
        .get('/cars')
        .set(asUserA())
        .expect(200);
      expect(res.body.data.some((c: { id: string }) => c.id === carId)).toBe(
        true,
      );
    });

    it("User B's list does not include User A's car", async () => {
      const res = await request(app.getHttpServer())
        .get('/cars')
        .set(asUserB())
        .expect(200);
      expect(res.body.data.some((c: { id: string }) => c.id === carId)).toBe(
        false,
      );
    });

    it("User B gets 404 fetching User A's car directly by id", () => {
      return request(app.getHttpServer())
        .get(`/cars/${carId}`)
        .set(asUserB())
        .expect(404);
    });

    it("User B cannot update User A's car", () => {
      return request(app.getHttpServer())
        .patch(`/cars/${carId}`)
        .set(asUserB())
        .send({ make: 'Toyota' })
        .expect(404);
    });

    it("User B cannot delete User A's car", () => {
      return request(app.getHttpServer())
        .delete(`/cars/${carId}`)
        .set(asUserB())
        .expect(404);
    });

    it('User A can still fetch, update, and delete their own car', async () => {
      await request(app.getHttpServer())
        .get(`/cars/${carId}`)
        .set(asUserA())
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/cars/${carId}`)
        .set(asUserA())
        .send({ odometerKm: 43000 })
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/cars/${carId}`)
        .set(asUserA())
        .expect(204);

      await request(app.getHttpServer())
        .get(`/cars/${carId}`)
        .set(asUserA())
        .expect(404);
    });
  });
});
