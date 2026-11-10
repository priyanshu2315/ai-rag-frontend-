import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterByQuery, matchesQuery } from '../src/utils/match.js';

const name = 'FIN-02_Budget_Review_v3.pdf';

test('separators, case and zero padding do not matter', () => {
  for (const query of ['fin 2', 'FIN 02', 'fin2', 'fin-2', 'fin_02', '  fin   2 ']) {
    assert.equal(matchesQuery(name, query), true, query);
  }
});

test('words can come in any order and match inside a word', () => {
  assert.equal(matchesQuery(name, 'budget fin'), true);
  assert.equal(matchesQuery(name, 'review 2'), true);
  assert.equal(matchesQuery(name, 'bud'), true);
  assert.equal(matchesQuery(name, 'v3'), true);
});

test('numbers compare by value, not as a prefix', () => {
  assert.equal(matchesQuery('FIN-20_Plan.pdf', 'fin 2'), false);
  assert.equal(matchesQuery('Quarterly report 2026.pdf', 'fin 2'), false);
  assert.equal(matchesQuery('FIN-20_Plan.pdf', 'fin 20'), true);
  assert.equal(matchesQuery('Ledger 0.pdf', 'ledger 000'), true);
});

test('every word must match', () => {
  assert.equal(matchesQuery(name, 'fin 4'), false);
  assert.equal(matchesQuery(name, 'fin payroll'), false);
});

test('a plain substring still matches as typed', () => {
  assert.equal(matchesQuery('Quarterly report 2026.pdf', 'port 20'), true);
  assert.equal(matchesQuery('Quarterly report 2026.pdf', 't 2026.p'), true);
  assert.equal(matchesQuery('Quarterly report 2026.pdf', '202'), true);
});

test('empty queries match everything; punctuation-only queries need a substring', () => {
  assert.equal(matchesQuery(name, ''), true);
  assert.equal(matchesQuery(name, '   '), true);
  assert.equal(matchesQuery(name, '_'), true);
  assert.equal(matchesQuery(name, '#'), false);
  assert.equal(matchesQuery(null, 'fin'), false);
});

test('filterByQuery keeps order and returns the same list for an empty query', () => {
  const docs = [{ filename: 'FIN-20.pdf' }, { filename: 'FIN-02_a.pdf' }, { filename: 'HR-02.pdf' }, { filename: 'fin-2 notes.txt' }];
  assert.deepEqual(filterByQuery(docs, 'fin 2', (d) => d.filename).map((d) => d.filename), ['FIN-02_a.pdf', 'fin-2 notes.txt']);
  assert.equal(filterByQuery(docs, ' ', (d) => d.filename), docs);
});
