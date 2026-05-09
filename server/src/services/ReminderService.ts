import cron from 'node-cron';
import { DateTime } from 'luxon';
import { AppointmentModel } from '../models/Appointment';
import type { MailService } from './mail/MailService';
import { logger } from '../utils/logger';

const TIMEZONE = 'Europe/Istanbul';

export class ReminderService {
  constructor(private readonly mailService: MailService) {}

  start(): void {
    cron.schedule('0 9 * * *', () => void this.sendDailyReminders(), {
      timezone: TIMEZONE,
    });
    logger.info('[ReminderService] Daily reminder cron scheduled at 09:00 Europe/Istanbul');
  }

  async sendDailyReminders(): Promise<void> {
    const now        = DateTime.now().setZone(TIMEZONE);
    const startOfDay = now.startOf('day').toISO()!;
    const endOfDay   = now.endOf('day').toISO()!;

    const appointments = await AppointmentModel.find({
      status:   'approved',
      dateTime: { $gte: startOfDay, $lte: endOfDay },
    });

    logger.info(`[ReminderService] ${appointments.length} appointment(s) found for today`);

    await Promise.allSettled(
      appointments.map((apt) =>
        this.mailService.sendReminder({
          name:             apt.name,
          email:            apt.email,
          dateTime:         apt.dateTime,
          bookingReference: apt.bookingReference,
        }).catch((err) =>
          logger.error(`[ReminderService] Reminder failed for ${apt.email}:`, err),
        ),
      ),
    );
  }
}
