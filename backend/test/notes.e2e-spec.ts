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

describe('Notes (e2e)', () => {
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
        googleId: `note-e2e-a-${Date.now()}`,
        email: `note-e2e-a-${Date.now()}@example.com`,
        username: `notee2ea${Date.now()}`,
      },
    });
    const userB = await prisma.user.create({
      data: {
        googleId: `note-e2e-b-${Date.now()}`,
        email: `note-e2e-b-${Date.now()}@example.com`,
        username: `notee2eb${Date.now()}`,
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
    await prisma.carNote.deleteMany({
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

  it('rejects every note route with no auth cookie', async () => {
    await request(app.getHttpServer())
      .get(`/cars/${userACarId}/notes`)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/cars/${userACarId}/notes`)
      .send({ body: 'hi' })
      .expect(401);
  });

  it('rejects an empty note body with 400', () => {
    return request(app.getHttpServer())
      .post(`/cars/${userACarId}/notes`)
      .set(asUserA())
      .send({ body: '' })
      .expect(400);
  });

  it("User B cannot create a note on User A's car", () => {
    return request(app.getHttpServer())
      .post(`/cars/${userACarId}/notes`)
      .set(asUserB())
      .send({ body: 'hijacked' })
      .expect(404);
  });

  describe('cross-user isolation', () => {
    let noteId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post(`/cars/${userACarId}/notes`)
        .set(asUserA())
        .send({ body: 'Replaced the timing belt' })
        .expect(201);
      noteId = res.body.id;
    });

    it("User B cannot list User A's car's notes", () => {
      return request(app.getHttpServer())
        .get(`/cars/${userACarId}/notes`)
        .set(asUserB())
        .expect(404);
    });

    it("User B gets 404 deleting User A's note directly by id", () => {
      return request(app.getHttpServer())
        .delete(`/notes/${noteId}`)
        .set(asUserB())
        .expect(404);
    });

    it('User A can list and delete their own note', async () => {
      const listRes = await request(app.getHttpServer())
        .get(`/cars/${userACarId}/notes`)
        .set(asUserA())
        .expect(200);
      expect(listRes.body.some((n: { id: string }) => n.id === noteId)).toBe(
        true,
      );

      await request(app.getHttpServer())
        .delete(`/notes/${noteId}`)
        .set(asUserA())
        .expect(204);

      const afterDelete = await request(app.getHttpServer())
        .get(`/cars/${userACarId}/notes`)
        .set(asUserA())
        .expect(200);
      expect(
        afterDelete.body.some((n: { id: string }) => n.id === noteId),
      ).toBe(false);
    });
  });
});
