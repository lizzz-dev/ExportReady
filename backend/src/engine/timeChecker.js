'use strict';
/**
 * ExportReady :: Time Feasibility Checker (F8)
 * Spec: brain/04_engine_and_algorithms/TIME_FEASIBILITY_SPEC.md
 *
 * Pure and deterministic. Efforts are summed sequentially (conservative).
 */

const { toDayNumber } = require('./dates');

function checkTimeFeasibility({ findings, shipmentDeadline, evaluationDate, safetyBufferDays = 5 } = {}) {
  if (!Array.isArray(findings)) throw new TypeError('findings must be an array');
  if (!Number.isInteger(safetyBufferDays) || safetyBufferDays < 0) {
    throw new TypeError('safetyBufferDays must be a non-negative integer');
  }
  const availableDays =
    toDayNumber(shipmentDeadline, 'shipmentDeadline') - toDayNumber(evaluationDate, 'evaluationDate');

  const counts = { met: 0, gap: 0, blocker: 0 };
  const blockerCodes = [];
  let totalEffort = 0;
  for (const f of findings) {
    if (!Object.prototype.hasOwnProperty.call(counts, f.verdict_status)) {
      throw new TypeError(`unknown verdict_status '${f.verdict_status}'`);
    }
    counts[f.verdict_status] += 1;
    if (f.verdict_status === 'met') continue;
    if (!Number.isInteger(f.assigned_effort_days) || f.assigned_effort_days < 0) {
      throw new TypeError(`${f.rule_code ?? '?'}: assigned_effort_days must be a non-negative integer`);
    }
    totalEffort += f.assigned_effort_days;
    if (f.verdict_status === 'blocker') blockerCodes.push(f.rule_code);
  }
  blockerCodes.sort();

  const marginDays = availableDays - totalEffort - safetyBufferDays;
  const days = (n) => `${n} day${Math.abs(n) === 1 ? '' : 's'}`;
  let verdict;
  let rationale;

  if (counts.blocker > 0) {
    verdict = 'NOT_FEASIBLE';
    const timeNote =
      totalEffort <= availableDays
        ? `Remaining effort (${days(totalEffort)}) would fit in ${days(availableDays)}, but`
        : `Remaining effort (${days(totalEffort)}) exceeds the ${days(availableDays)} available, and`;
    rationale = `${timeNote} ${counts.blocker} unresolved blocker(s) (${blockerCodes.join(', ')}) mean the order cannot ship until each is cleared.`;
  } else if (totalEffort === 0) {
    if (availableDays >= 0) {
      verdict = 'FEASIBLE';
      rationale = 'No gaps or blockers: nothing to fix before the deadline.';
    } else {
      verdict = 'NOT_FEASIBLE';
      rationale = `No gaps or blockers, but the shipment deadline passed ${days(-availableDays)} ago.`;
    }
  } else if (totalEffort + safetyBufferDays <= availableDays) {
    verdict = 'FEASIBLE';
    rationale = `${days(totalEffort)} of fixes plus a ${days(safetyBufferDays)} buffer fit within ${days(availableDays)} (margin ${days(marginDays)}).`;
  } else if (totalEffort <= availableDays) {
    verdict = 'AT_RISK';
    rationale = `${days(totalEffort)} of fixes fit within ${days(availableDays)} only without the ${days(safetyBufferDays)} safety buffer (margin ${marginDays} days).`;
  } else {
    verdict = 'NOT_FEASIBLE';
    rationale =
      availableDays < 0
        ? `The shipment deadline passed ${days(-availableDays)} ago and ${days(totalEffort)} of fixes remain.`
        : `${days(totalEffort)} of fixes cannot fit within the ${days(availableDays)} available.`;
  }

  return {
    verdict,
    available_days: availableDays,
    total_effort_days: totalEffort,
    safety_buffer_days: safetyBufferDays,
    margin_days: marginDays,
    counts,
    rationale,
  };
}

module.exports = { checkTimeFeasibility };
