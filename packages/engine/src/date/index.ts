/**
 * Utilitários de data para o projeto SILO
 * Timezone: São Paulo (America/Sao_Paulo)
 */

import { DATE_CONFIG } from "./date-config";

export const TIMEZONE = DATE_CONFIG.TIMEZONE;
export const DATE_FORMAT = DATE_CONFIG.DATE_FORMAT;
export const DATETIME_FORMAT = DATE_CONFIG.DATETIME_FORMAT;
export const DISPLAY_DATE_FORMAT = DATE_CONFIG.DISPLAY_DATE_FORMAT;
export const DISPLAY_DATETIME_FORMAT = DATE_CONFIG.DISPLAY_DATETIME_FORMAT;

export function getToday(): string {
  return formatDate(new Date());
}

export function getTodayDate(): Date {
  return new Date();
}

export function formatDate(date: Date | string): string {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  const dateObj = typeof date === "string" ? new Date(date) : date;

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DATE_CONFIG.TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dateObj);
}

export function parseDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getDaysAgo(days: number): string {
  const today = getTodayDate();
  today.setDate(today.getDate() - days);
  return formatDate(today);
}

export function getMonthsAgo(months: number): string {
  const today = getTodayDate();
  today.setMonth(today.getMonth() - months);
  today.setDate(1);
  return formatDate(today);
}

export function isToday(dateString: string): boolean {
  return dateString === getToday();
}

export function getNowTimestamp(): string {
  const now = new Date();
  return now.toLocaleString("en-US", { timeZone: DATE_CONFIG.TIMEZONE });
}

export function formatDateBR(dateString: string): string {
  const date = parseDate(dateString);
  return date.toLocaleDateString(DATE_CONFIG.LOCALE);
}

export function formatDateTimeBR(
  dateString: string,
  timeString?: string,
): string {
  const date = parseDate(dateString);
  if (timeString) {
    const [hours, minutes] = timeString.split(":");
    date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  }
  return date.toLocaleString(DATE_CONFIG.LOCALE, {
    timeZone: DATE_CONFIG.TIMEZONE,
  });
}

export function formatDateTimeFullBR(dateString: string): string {
  if (!dateString) return "Data inválida";

  let date: Date;

  if (dateString.includes(" ")) {
    date = new Date(dateString.replace(" ", "T"));
  } else {
    date = parseDate(dateString);
  }

  if (isNaN(date.getTime())) {
    return "Data inválida";
  }

  return date.toLocaleString(DATE_CONFIG.LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: DATE_CONFIG.TIMEZONE,
  });
}

export function formatDateTimeShortBR(dateString: string): string {
  if (!dateString) return "Data inválida";

  let date: Date;

  if (dateString.includes(" ")) {
    date = new Date(dateString.replace(" ", "T"));
  } else {
    date = parseDate(dateString);
  }

  if (isNaN(date.getTime())) {
    return "Data inválida";
  }

  return date.toLocaleString(DATE_CONFIG.LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: DATE_CONFIG.TIMEZONE,
  });
}
