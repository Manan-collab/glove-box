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

describe('Friends (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userA: { id: string; username: string };
  let userB: { id: string; username: string };
  let userC: { id: string; username: string };
  let tokenA: string;
  let tokenB: string;
  let tokenC: string;
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
    const jwt = app.get(JwtService);
    const config = app.get(ConfigService);
    const secret = config.getOrThrow<string>('jwt.secret');

    const stamp = Date.now();
    userA = await prisma.user.create({
      data: {
        googleId: `fr-e2e-a-${stamp}`,
        email: `fr-e2e-a-${stamp}@example.com`,
        username: `fre2ea${stamp}`,
      },
    });
    userB = await prisma.user.create({
      data: {
        googleId: `fr-e2e-b-${stamp}`,
        email: `fr-e2e-b-${stamp}@example.com`,
        username: `fre2eb${stamp}`,
      },
    });
    userC = await prisma.user.create({
      data: {
        googleId: `fr-e2e-c-${stamp}`,
        email: `fr-e2e-c-${stamp}@example.com`,
        username: `fre2ec${stamp}`,
      },
    });
    createdUserIds.push(userA.id, userB.id, userC.id);

    tokenA = jwt.sign({ sub: userA.id }, { secret, expiresIn: '15m' });
    tokenB = jwt.sign({ sub: userB.id }, { secret, expiresIn: '15m' });
    tokenC = jwt.sign({ sub: userC.id }, { secret, expiresIn: '15m' });

    await prisma.car.create({
      data: {
        userId: userA.id,
        make: 'Honda',
        model: 'Civic',
        year: 2020,
        variant: 'VTi-L',
        vin: 'SECRET-VIN-123',
        engine: '1.8L i-VTEC',
        fuelType: 'Petrol',
        transmission: 'CVT',
        bodyType: 'Sedan',
        odometerKm: 42000,
      },
    });
  });

  afterAll(async () => {
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userAId: { in: createdUserIds } },
          { userBId: { in: createdUserIds } },
        ],
      },
    });
    await prisma.friendRequest.deleteMany({
      where: {
        OR: [
          { fromUserId: { in: createdUserIds } },
          { toUserId: { in: createdUserIds } },
        ],
      },
    });
    await prisma.car.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  const asA = () => ({ Cookie: [`access_token=${tokenA}`] });
  const asB = () => ({ Cookie: [`access_token=${tokenB}`] });
  const asC = () => ({ Cookie: [`access_token=${tokenC}`] });

  it('rejects every friends/users route with no auth cookie', async () => {
    await request(app.getHttpServer()).get('/friends').expect(401);
    await request(app.getHttpServer()).get('/friends/requests').expect(401);
    await request(app.getHttpServer())
      .post(`/friends/requests/${userB.username}`)
      .expect(401);
    await request(app.getHttpServer())
      .get(`/users/${userA.username}/garage`)
      .expect(401);
  });

  it("User C cannot view a non-friend's garage before any request exists", () => {
    return request(app.getHttpServer())
      .get(`/users/${userA.username}/garage`)
      .set(asC())
      .expect(404);
  });

  it('sending a request to a nonexistent username 404s', () => {
    return request(app.getHttpServer())
      .post('/friends/requests/no-such-user-at-all')
      .set(asA())
      .expect(404);
  });

  it('refuses a request to yourself', () => {
    return request(app.getHttpServer())
      .post(`/friends/requests/${userA.username}`)
      .set(asA())
      .expect(409);
  });

  describe('request -> reject -> re-request -> accept -> view garage -> unfriend', () => {
    it('User A sends a request to User B', async () => {
      await request(app.getHttpServer())
        .post(`/friends/requests/${userB.username}`)
        .set(asA())
        .expect(201);
    });

    it('sending the identical request again is a conflict', () => {
      return request(app.getHttpServer())
        .post(`/friends/requests/${userB.username}`)
        .set(asA())
        .expect(409);
    });

    it('User B sending a request back to User A is a conflict — accept instead', () => {
      return request(app.getHttpServer())
        .post(`/friends/requests/${userA.username}`)
        .set(asB())
        .expect(409);
    });

    it('User A sees the pending request in "outgoing", User B sees it in "incoming"', async () => {
      const aRes = await request(app.getHttpServer())
        .get('/friends/requests')
        .set(asA())
        .expect(200);
      expect(aRes.body.outgoing).toHaveLength(1);
      expect(aRes.body.outgoing[0].user.username).toBe(userB.username);
      expect(aRes.body.incoming).toHaveLength(0);

      const bRes = await request(app.getHttpServer())
        .get('/friends/requests')
        .set(asB())
        .expect(200);
      expect(bRes.body.incoming).toHaveLength(1);
      expect(bRes.body.incoming[0].user.username).toBe(userA.username);
    });

    it('User C cannot reject a request that was not sent to them', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/friends/requests')
        .set(asB())
        .expect(200);
      const requestId = body.incoming[0].id;

      await request(app.getHttpServer())
        .post(`/friends/requests/${requestId}/reject`)
        .set(asC())
        .expect(404);
    });

    it('User B rejects the request — it disappears, and no friendship is created', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/friends/requests')
        .set(asB())
        .expect(200);
      const requestId = body.incoming[0].id;

      await request(app.getHttpServer())
        .post(`/friends/requests/${requestId}/reject`)
        .set(asB())
        .expect(200);

      const after = await request(app.getHttpServer())
        .get('/friends/requests')
        .set(asB())
        .expect(200);
      expect(after.body.incoming).toHaveLength(0);

      const friendsOfA = await request(app.getHttpServer())
        .get('/friends')
        .set(asA())
        .expect(200);
      expect(friendsOfA.body).toEqual([]);
    });

    it('User A can send a fresh request after the rejection (no permanent unique-constraint block)', async () => {
      await request(app.getHttpServer())
        .post(`/friends/requests/${userB.username}`)
        .set(asA())
        .expect(201);
    });

    it("User B still cannot view User A's garage while the request is only pending", () => {
      return request(app.getHttpServer())
        .get(`/users/${userA.username}/garage`)
        .set(asB())
        .expect(404);
    });

    it('User B accepts the request', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/friends/requests')
        .set(asB())
        .expect(200);
      const requestId = body.incoming[0].id;

      await request(app.getHttpServer())
        .post(`/friends/requests/${requestId}/accept`)
        .set(asB())
        .expect(200);
    });

    it('both users now see each other in /friends, and the pending request is gone', async () => {
      const friendsOfA = await request(app.getHttpServer())
        .get('/friends')
        .set(asA())
        .expect(200);
      expect(friendsOfA.body).toHaveLength(1);
      expect(friendsOfA.body[0].username).toBe(userB.username);

      const friendsOfB = await request(app.getHttpServer())
        .get('/friends')
        .set(asB())
        .expect(200);
      expect(friendsOfB.body).toHaveLength(1);
      expect(friendsOfB.body[0].username).toBe(userA.username);

      const requestsOfB = await request(app.getHttpServer())
        .get('/friends/requests')
        .set(asB())
        .expect(200);
      expect(requestsOfB.body.incoming).toHaveLength(0);
    });

    it("User B can now view User A's public garage, without VIN or odometer", async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/${userA.username}/garage`)
        .set(asB())
        .expect(200);

      expect(res.body.user.username).toBe(userA.username);
      expect(res.body.cars).toHaveLength(1);
      expect(res.body.cars[0].make).toBe('Honda');
      expect(res.body.cars[0]).not.toHaveProperty('vin');
      expect(res.body.cars[0]).not.toHaveProperty('odometerKm');
    });

    it("User C (a stranger) still cannot view User A's garage", () => {
      return request(app.getHttpServer())
        .get(`/users/${userA.username}/garage`)
        .set(asC())
        .expect(404);
    });

    it('User A unfriends User B', async () => {
      await request(app.getHttpServer())
        .delete(`/friends/${userB.id}`)
        .set(asA())
        .expect(204);
    });

    it('after unfriending, neither sees the other in /friends, and the garage view 404s again', async () => {
      const friendsOfA = await request(app.getHttpServer())
        .get('/friends')
        .set(asA())
        .expect(200);
      expect(friendsOfA.body).toEqual([]);

      await request(app.getHttpServer())
        .get(`/users/${userA.username}/garage`)
        .set(asB())
        .expect(404);
    });

    it('unfriending someone you are not friends with 404s', () => {
      return request(app.getHttpServer())
        .delete(`/friends/${userC.id}`)
        .set(asA())
        .expect(404);
    });
  });
});
