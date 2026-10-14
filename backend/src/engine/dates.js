'use strict';
/**
 * Internal date helper for the core engine.
 * All engine date maths is done on whole UTC calendar days so results never depend on the
 * machine's timezone or on the time-of-day part of a timestamp.
 *
 * Accepted inputs: 'YYYY-MM-DD' (preferred; a trailing time part is ignored) or a Date
 * (its UTC calendar date is used). Anything else throws.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const MS_PER_DAY = 86400000;

function toDayNumber(value, label = 'date') {
  let y;
  let m;
  let d;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new TypeError(`${label}: invalid Date`);
    y = value.getUTCFullYear();
    m = value.getUTCMonth() + 1;
    d = value.getUTCDate();
  } else if (typeof value === 'string') {
    const match = ISO_DATE.exec(value.trim());
    if (!match) throw new TypeError(`${label}: expected 'YYYY-MM-DD', got '${value}'`);
    y = Number(match[1]);
    m = Number(match[2]);
    d = Number(match[3]);
    const probe = new Date(Date.UTC(y, m - 1, d));
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
      throw new TypeError(`${label}: '${value}' is not a real calendar date`);
    }
  } else {
    throw new TypeError(`${label}: expected 'YYYY-MM-DD' string or Date`);
  }
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

function dayNumberToIso(dayNumber) {
  return new Date(dayNumber * MS_PER_DAY).toISOString().slice(0, 10);
}

module.exports = { toDayNumber, dayNumberToIso };
