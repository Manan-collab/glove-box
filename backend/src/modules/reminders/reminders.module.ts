import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { InsuranceRemindersService } from './insurance-reminders.service';

@Module({
  imports: [MailModule],
  providers: [InsuranceRemindersService],
})
export class RemindersModule {}
