import type { FieldReport, FillReport } from './runFill'

type ProblemStatus = Exclude<FieldReport['status'], 'filled' | 'skipped'>

export const STATUS_TEXT: Record<FieldReport['status'], string> = {
  filled: 'befüllt',
  skipped: 'übersprungen',
  missing: 'nicht gefunden',
  ambiguous: 'mehrdeutig',
  failed: 'nicht befüllbar',
}

const PROBLEMS: ProblemStatus[] = ['missing', 'ambiguous', 'failed']

export function isProblem(status: FieldReport['status']): status is ProblemStatus {
  return (PROBLEMS as string[]).includes(status)
}

/** A run error counts as one problem so the badge never shows "all fine" for a failed run. */
export function problemCount(report: FillReport): number {
  if (report.error !== undefined) return 1
  return report.fields.filter((f) => isProblem(f.status)).length
}

/** e.g. "11 von 12 befüllt · 1 nicht gefunden" */
export function summarizeReport(report: FillReport): string {
  const parts = [`${report.filled} von ${report.total} befüllt`]
  for (const status of PROBLEMS) {
    const count = report.fields.filter((f) => f.status === status).length
    if (count > 0) parts.push(`${count} ${STATUS_TEXT[status]}`)
  }
  return parts.join(' · ')
}
