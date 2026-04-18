import { google, calendar_v3 } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import type { Appointment } from '../../../../shared/types';
import { addMinutesToIso } from '../../../../shared/dateUtils';
import { logger } from '../../utils/logger';

interface CalendarConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  calendarId: string;
  appointmentDurationMinutes: number;
}

export class CalendarService {
  constructor(private readonly cfg: CalendarConfig) {
    const required: (keyof CalendarConfig)[] = [
      'clientId', 'clientSecret', 'refreshToken', 'calendarId',
    ];
    for (const k of required) {
      if (!cfg[k]) throw new Error(`CalendarService: missing config "${k}"`);
    }
  }

  /**
   * Creates a Google Calendar event with a Google Meet link.
   * Returns the fully populated Appointment model.
   */
  async createAppointment(params: {
    name: string;
    email: string;
    startTime: string; // ISO 8601
    enquirySummary: string;
    originalEnquiry: string;
  }): Promise<Appointment> {
    const endTime = addMinutesToIso(params.startTime, this.cfg.appointmentDurationMinutes);
    const calendar = await this.buildClient();

    const body: calendar_v3.Schema$Event = {
      summary: `Appointment Scheduled - ${params.name} & Jim`,
      description: `${params.enquirySummary}\n\nOriginal message:\n> ${params.originalEnquiry}`,
      start: { dateTime: params.startTime },
      end: { dateTime: endTime },
      attendees: [{ email: params.email }],
      transparency: 'opaque',
      visibility: 'default',
      conferenceData: {
        createRequest: {
          requestId: uuidv4(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };

    logger.debug(`[CalendarService] Creating event for ${params.email} @ ${params.startTime}`);

    const response = await calendar.events.insert({
      calendarId: this.cfg.calendarId,
      conferenceDataVersion: 1,
      requestBody: body,
    });

    const event = response.data;
    const conferenceLink =
      event.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === 'video')?.uri ??
      undefined;

    logger.info(`[CalendarService] Event created: ${event.id}`);

    return {
      id: event.id ?? uuidv4(),
      summary: event.summary ?? '',
      description: event.description ?? '',
      startTime: event.start?.dateTime ?? params.startTime,
      endTime: event.end?.dateTime ?? endTime,
      attendeeEmail: params.email,
      attendeeName: params.name,
      conferenceLink,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Deletes a Google Calendar event by its event ID.
   * Silently succeeds if the event is already gone (410/404).
   */
  async deleteEvent(eventId: string): Promise<void> {
    const calendar = await this.buildClient();
    try {
      await calendar.events.delete({
        calendarId: this.cfg.calendarId,
        eventId,
      });
      logger.info(`[CalendarService] Event deleted: ${eventId}`);
    } catch (err: unknown) {
      const status = (err as { code?: number })?.code;
      if (status === 404 || status === 410) {
        logger.warn(`[CalendarService] Event already gone: ${eventId}`);
        return;
      }
      throw err;
    }
  }

  private async buildClient(): Promise<calendar_v3.Calendar> {
    const auth = new google.auth.OAuth2(this.cfg.clientId, this.cfg.clientSecret);
    auth.setCredentials({ refresh_token: this.cfg.refreshToken });
    return google.calendar({ version: 'v3', auth });
  }
}
