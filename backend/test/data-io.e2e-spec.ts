import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { App } from 'supertest/types';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import {
  CAR_HEADER_FIELDS,
  EXPENSE_COLUMNS,
  EXPENSE_DATA_START_ROW,
} from '../src/modules/data-io/workbook/workbook-columns';

async function buildWorkbookBuffer(
  sheets: Array<{
    name: string;
    car: Record<string, unknown>;
    expenses?: Array<Record<string, unknown>>;
  }>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const sheetDef of sheets) {
    const sheet = workbook.addWorksheet(sheetDef.name);
    for (const field of CAR_HEADER_FIELDS) {
      const value = sheetDef.car[field.key];
      sheet.getCell(field.row, 2).value =
        value === undefined ? null : (value as string | number);
    }
    (sheetDef.expenses ?? []).forEach((expense, index) => {
      const row = EXPENSE_DATA_START_ROW + index;
      for (const col of EXPENSE_COLUMNS) {
        const value = expense[col.key];
        sheet.getCell(row, col.col).value =
          value === undefined ? null : (value as string | number);
      }
    });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function fullCarSheet(overrides: Record<string, unknown> = {}) {
  return {
    carId: '',
    make: 'Maruti Suzuki',
    model: 'Swift',
    year: 2022,
    variant: 'ZXI+',
    vin: '',
    engine: '1.2L K-Series',
    fuelType: 'Petrol',
    transmission: 'Manual',
    bodyType: 'Hatchback',
    powerBhp: 89,
    odometerKm: 24500,
    ...overrides,
  };
}

describe('DataIo (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userAToken: string;
  let userBToken: string;
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

    const userA = await prisma.user.create({
      data: {
        googleId: `dataio-e2e-a-${Date.now()}`,
        email: `dataio-e2e-a-${Date.now()}@example.com`,
        username: `dataioe2ea${Date.now()}`,
      },
    });
    const userB = await prisma.user.create({
      data: {
        googleId: `dataio-e2e-b-${Date.now()}`,
        email: `dataio-e2e-b-${Date.now()}@example.com`,
        username: `dataioe2eb${Date.now()}`,
      },
    });
    createdUserIds.push(userA.id, userB.id);

    userAToken = jwt.sign({ sub: userA.id }, { secret, expiresIn: '15m' });
    userBToken = jwt.sign({ sub: userB.id }, { secret, expiresIn: '15m' });
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

  it('rejects every data-io route with no auth cookie', async () => {
    await request(app.getHttpServer()).get('/data-io/export').expect(401);
    await request(app.getHttpServer()).get('/data-io/template').expect(401);
    await request(app.getHttpServer()).post('/data-io/import').expect(401);
  });

  it('template contains no real data, just the Read Me + Example Car sheets', async () => {
    const res = await request(app.getHttpServer())
      .get('/data-io/template')
      .set(asUserA())
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body);
    expect(wb.worksheets.map((s) => s.name)).toEqual([
      'Read Me',
      'Example Car',
    ]);
  });

  it('imports new cars and expenses, then exports them back out correctly', async () => {
    const importBuffer = await buildWorkbookBuffer([
      {
        name: 'My Swift',
        car: fullCarSheet(),
        expenses: [
          {
            expenseId: '',
            category: 'FUEL',
            amount: 1500,
            currency: 'INR',
            expenseDate: '2026-08-01',
            odometerKm: 24500,
            litres: 12,
            fuelPricePerLitre: 100,
          },
        ],
      },
    ]);

    const importRes = await request(app.getHttpServer())
      .post('/data-io/import')
      .set(asUserA())
      .attach('file', importBuffer, 'import.xlsx')
      .expect(201);

    expect(importRes.body).toEqual(
      expect.objectContaining({
        carsCreated: 1,
        expensesCreated: 1,
        errors: [],
      }),
    );

    const exportRes = await request(app.getHttpServer())
      .get('/data-io/export')
      .set(asUserA())
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(exportRes.body);
    const sheet = wb.getWorksheet('Swift 2022');
    expect(sheet).toBeDefined();
    expect(sheet!.getCell(3, 2).value).toBe('Maruti Suzuki');
    expect(sheet!.getCell(EXPENSE_DATA_START_ROW, 2).value).toBe('FUEL');
    expect(sheet!.getCell(EXPENSE_DATA_START_ROW, 3).value).toBe(1500);
  });

  it('re-importing the exact same exported file updates rather than duplicates', async () => {
    const exportRes = await request(app.getHttpServer())
      .get('/data-io/export')
      .set(asUserA())
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    const carsBefore = await prisma.car.count({
      where: { userId: { in: createdUserIds } },
    });
    const expensesBefore = await prisma.expense.count({
      where: { car: { userId: { in: createdUserIds } } },
    });

    const reimportRes = await request(app.getHttpServer())
      .post('/data-io/import')
      .set(asUserA())
      .attach('file', exportRes.body as Buffer, 'reimport.xlsx')
      .expect(201);

    expect(reimportRes.body.carsCreated).toBe(0);
    expect(reimportRes.body.expensesCreated).toBe(0);
    expect(reimportRes.body.carsUpdated).toBeGreaterThan(0);

    const carsAfter = await prisma.car.count({
      where: { userId: { in: createdUserIds } },
    });
    const expensesAfter = await prisma.expense.count({
      where: { car: { userId: { in: createdUserIds } } },
    });
    expect(carsAfter).toBe(carsBefore);
    expect(expensesAfter).toBe(expensesBefore);
  });

  it("rejects a sheet referencing another user's Car ID and leaves that data untouched", async () => {
    const userACar = await prisma.car.findFirst({
      where: { userId: createdUserIds[0] },
    });
    expect(userACar).not.toBeNull();
    const originalOdometer = userACar!.odometerKm;

    const attackBuffer = await buildWorkbookBuffer([
      {
        name: 'Attack',
        car: fullCarSheet({ carId: userACar!.id, odometerKm: 999999 }),
      },
    ]);

    const res = await request(app.getHttpServer())
      .post('/data-io/import')
      .set(asUserB())
      .attach('file', attackBuffer, 'attack.xlsx')
      .expect(201);

    expect(res.body.carsUpdated).toBe(0);
    expect(res.body.errors).toEqual([
      expect.objectContaining({
        sheet: 'Attack',
        message: expect.stringContaining('not found or is not yours'),
      }),
    ]);

    const unchangedCar = await prisma.car.findUnique({
      where: { id: userACar!.id },
    });
    expect(unchangedCar!.odometerKm).toBe(originalOdometer);
  });

  it('rejects a malformed (non-xlsx) file with 400', async () => {
    await request(app.getHttpServer())
      .post('/data-io/import')
      .set(asUserA())
      .attach('file', Buffer.from('this is not an excel file'), 'bad.xlsx')
      .expect(400);
  });

  it('rejects a file exceeding the size limit', async () => {
    const oversized = Buffer.alloc(6 * 1024 * 1024, 'a');
    await request(app.getHttpServer())
      .post('/data-io/import')
      .set(asUserA())
      .attach('file', oversized, 'huge.xlsx')
      .expect((res) => {
        expect([400, 413]).toContain(res.status);
      });
  });
});
