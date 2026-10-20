import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { MailService } from '../mail/mail.service';
import { renderInsuranceExpiryEmail } from '../mail/templates/insurance-expiry.template';

// Days before expiry that each reminder goes out.
export const INSURANCE_REMINDER_STAGES = [30, 7, 1] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const TIME_ZONE = 'Asia/Kolkata';

const REMINDER_CAR_SELECT = {
  id: true,
  make: true,
  model: true,
  year: true,
  variant: true,
  fuelType: true,
  insuranceExpiryDate: true,
  user: {
    select: { email: true, username: true, displayName: true, avatarUrl: true },
  },
} satisfies Prisma.CarSelect;

type ReminderCar = Prisma.CarGetPayload<{ select: typeof REMINDER_CAR_SELECT }>;

// The reminder a car is due today, or null. Picks the tightest stage that
// still covers daysLeft, so a missed run (server asleep, deploy) catches up
// at the right urgency instead of skipping a stage — and an expiry set 20
// days out still gets its "30 days" reminder, just reading "20 days".
export function stageFor(daysLeft: number): number | null {
  if (daysLeft < 0) return null;
  const stages = [...INSURANCE_REMINDER_STAGES].sort((a, b) => a - b);
  return stages.find((stage) => daysLeft <= stage) ?? null;
}

// Today's calendar date in India, as UTC midnight — the same shape the app
// stores insuranceExpiryDate in (`new Date('YYYY-MM-DD')`).
export function todayInIndia(now: Date): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(
    now,
  );
  return new Date(`${ymd}T00:00:00.000Z`);
}

function utcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

@Injectable()
export class InsuranceRemindersService {
  private readonly logger = new Logger(InsuranceRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  @Cron('0 9 * * *', { name: 'insurance-reminders', timeZone: TIME_ZONE })
  async handleCron() {
    await this.sendDueReminders(new Date());
  }

  async sendDueReminders(now: Date): Promise<{ sent: number }> {
    const today = todayInIndia(now);
    const maxStage = Math.max(...INSURANCE_REMINDER_STAGES);
    const cars = await this.prisma.car.findMany({
      where: {
        insuranceExpiryDate: {
          gte: today,
          lt: new Date(today.getTime() + (maxStage + 1) * DAY_MS),
        },
      },
      select: REMINDER_CAR_SELECT,
    });

    // Sequential, not Promise.all — see Section 0's Prisma driver-adapter
    // gotcha. One car failing must not stop the rest.
    let sent = 0;
    for (const car of cars) {
      try {
        if (await this.remind(car, today)) sent++;
      } catch (error) {
        this.logger.error(
          `Insurance reminder for car ${car.id} failed: ${(error as Error).message}`,
        );
      }
    }
    this.logger.log(
      `Insurance reminders: ${sent} sent, ${cars.length} cars checked`,
    );
    return { sent };
  }

  private async remind(car: ReminderCar, today: Date): Promise<boolean> {
    const dueDate = utcDay(car.insuranceExpiryDate!);
    const daysLeft = Math.round((dueDate.getTime() - today.getTime()) / DAY_MS);
    const stage = stageFor(daysLeft);
    if (stage === null) return false;

    // Claim before sending: the unique key turns a re-run or a second
    // instance into a P2002 here instead of a duplicate email.
    let claimId: string;
    try {
      const claim = await this.prisma.sentReminder.create({
        data: { carId: car.id, kind: 'INSURANCE_EXPIRY', dueDate, stage },
      });
      claimId = claim.id;
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') return false;
      throw error;
    }

    const lastRenewal = await this.prisma.expense.findFirst({
      where: { carId: car.id, category: 'INSURANCE' },
      orderBy: { expenseDate: 'desc' },
      select: { amount: true, currency: true, expenseDate: true },
    });

    const delivered = await this.mail.send(
      car.user.email,
      renderInsuranceExpiryEmail({
        appUrl: this.mail.appUrl,
        user: car.user,
        car,
        expiryDate: dueDate,
        daysLeft,
        lastRenewal: lastRenewal && {
          amount: Number(lastRenewal.amount),
          currency: lastRenewal.currency,
          date: lastRenewal.expenseDate,
        },
      }),
    );
    if (!delivered) {
      // Release the claim so tomorrow's run tries this stage again.
      await this.prisma.sentReminder.delete({ where: { id: claimId } });
    }
    return delivered;
  }
}
