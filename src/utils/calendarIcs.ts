ABOUTME: ABOUTME: Utility for generating iCalendar (.ics) feeds and download links from course calendar events.

import { CourseCalendarEvent } from '@/types/course';

const ICS_LINE_LIMIT = 75;

function icsEscape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

function foldLine(line: string): string {
  if (line.length <= ICS_LINE_LIMIT) return line;
  const parts: string[] = [];
  let i = 0;
  while (i < line.length) {
    const chunk = line.slice(i, i + ICS_LINE_LIMIT);
    parts.push(i === 0 ? chunk : ` ${chunk}`);
    i += ICS_LINE_LIMIT;
  }
  return parts.join('\r\n');
}

function buildProperty(name: string, value: string, params?: Record<string, string>): string {
  let line = name;
  if (params && Object.keys(params).length > 0) {
    for (const [key, val] of Object.entries(params)) {
      line += `;${key}=${val}`;
    }
  }
  line += `:${icsEscape(value)}`;
  return foldLine(line);
}

function formatIcsDate(date: Date, allDay = false): string {
  if (allDay) {
    return date.toISOString().slice(0, 10).replace(/-/g, '');
  }
  return date.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
}

function generateUid(event: CourseCalendarEvent): string {
  // Deterministic UID based on event id and course id so feed subscribers see updates as edits.
  const raw = `${event.course_id}-${event.id}@insightscollective.org`;
  return raw;
}

export function generateCourseICS(courseTitle: string, events: CourseCalendarEvent[]): string {
  const now = new Date();
  const dtStamp = formatIcsDate(now);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Insights Collective//Course Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    buildProperty('X-WR-CALNAME', courseTitle),
    buildProperty('X-WR-TIMEZONE', 'UTC'),
  ];

  for (const event of events) {
    const start = new Date(event.start_date);
    const end = event.end_date
      ? new Date(event.end_date)
      : new Date(start.getTime() + 60 * 60 * 1000);

    lines.push('BEGIN:VEVENT');
    lines.push(buildProperty('UID', generateUid(event)));
    lines.push(buildProperty('DTSTAMP', dtStamp));
    lines.push(buildProperty('SUMMARY', event.title));

    if (event.all_day) {
      lines.push(buildProperty('DTSTART', formatIcsDate(start, true), { VALUE: 'DATE' }));
      lines.push(buildProperty('DTEND', formatIcsDate(end, true), { VALUE: 'DATE' }));
    } else {
      lines.push(buildProperty('DTSTART', formatIcsDate(start)));
      lines.push(buildProperty('DTEND', formatIcsDate(end)));
    }

    if (event.description?.trim()) {
      lines.push(buildProperty('DESCRIPTION', event.description));
    }

    if (event.location?.trim()) {
      lines.push(buildProperty('LOCATION', event.location));
    }

    if (event.link?.trim()) {
      lines.push(buildProperty('URL', event.link));
    }

    const category = event.type ? event.type.charAt(0).toUpperCase() + event.type.slice(1) : 'Course';
    lines.push(buildProperty('CATEGORIES', category));
    lines.push(buildProperty('STATUS', 'CONFIRMED'));
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

export function downloadICS(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function buildGoogleCalendarSubscribeUrl(icsUrl: string): string {
  return `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(icsUrl)}`;
}

export function buildWebcalUrl(httpsUrl: string): string {
  return httpsUrl.replace(/^https?:\/\//i, 'webcal://');
}
