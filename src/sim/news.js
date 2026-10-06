// THE DAILY PIPELINE: a Paperboy-style front page between days, written from what
// actually happened yesterday on the Row.
// Yesterday's numbers for the stats column.
export function yesterday(m, before) {
  const d = (key) => (m.stats[key] ?? 0) - (before[key] ?? 0);
  return [
    ['CANS LIT', d('cansLit')],
    ['BROS LIT', d('brosLit')],
    ['HOUSES GONE', m.destroyed - (before.destroyed ?? 0)],
    ['BEST COMBO', (m.dayBestCombo ?? 0).toLocaleString()], // yesterday's, not the run's
  ];
}
export function headline(m, before) {
  const d = (key) => (m.stats[key] ?? 0) - (before[key] ?? 0);
  const gone = m.destroyed - (before.destroyed ?? 0);
  if (gone >= 2) return `${gone} FRAT HOUSES GONE ON GREEK ROW`;
  if (gone === 1 && m.lastGone) return `${m.lastGone}: GONE`;
  if (d('bees') > 0) return 'BEES EVICT A WHOLE CHAPTER';
  if (d('brosLit') >= 5) return `${d('brosLit')} BROS LIT; FIRE CO. “EXHAUSTED”`;
  if (d('fdRescues') > 0) return 'FIRE DEPT. SAVES COUCH HOUSE (AGAIN)';
  if (d('backflips') >= 3) return 'LOCAL SKATER WON’T STOP DOING BACKFLIPS';
  if (d('cansLit') > 0) return `${d('cansLit')} TRASH CANS ABLAZE ON GREEK ROW`;
  return 'QUIET DAY ON GREEK ROW… TOO QUIET';
}
