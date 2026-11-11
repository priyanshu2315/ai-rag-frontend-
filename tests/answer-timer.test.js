import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { formatDuration } from '../src/utils/format.js';

let vite;
let AnswerTimer;
before(async () => {
  vite = await createServer({ configFile: false, server: { middlewareMode: true, ws: false, watch: null }, appType: 'custom' });
  ({ default: AnswerTimer } = await vite.ssrLoadModule('/src/components/chat/AnswerTimer.jsx'));
});
after(async () => vite?.close());

const text = (html) => html.replace(/<[^>]*>/g, '');

test('durations read as seconds, then minutes', () => {
  assert.equal(formatDuration(860), '0.9s');
  assert.equal(formatDuration(12400), '12.4s');
  assert.equal(formatDuration(65000), '1m 05s');
  assert.equal(formatDuration(600000), '10m 00s');
  assert.equal(formatDuration(-1), '');
  assert.equal(formatDuration(NaN), '');
});

test('a finished answer says how long it took, a stopped one says so', () => {
  const startedAt = '2026-01-01T10:00:00.000Z';
  const finishedAt = Date.parse(startedAt) + 12400;
  assert.equal(text(renderToStaticMarkup(createElement(AnswerTimer, { startedAt, finishedAt, streaming: false }))), 'Answered in 12.4s');
  assert.equal(text(renderToStaticMarkup(createElement(AnswerTimer, { startedAt, finishedAt, streaming: false, stopped: true }))), 'Stopped after 12.4s');
});

test('a streaming answer shows a running time; history without a finish time shows nothing', () => {
  const startedAt = new Date().toISOString();
  assert.match(text(renderToStaticMarkup(createElement(AnswerTimer, { startedAt, streaming: true }))), /^\d+\.\ds$/);
  assert.equal(renderToStaticMarkup(createElement(AnswerTimer, { startedAt, streaming: false })), '');
  assert.equal(renderToStaticMarkup(createElement(AnswerTimer, { startedAt: undefined, streaming: true })), '');
});
