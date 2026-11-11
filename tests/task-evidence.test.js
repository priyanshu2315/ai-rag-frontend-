import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { buildTaskEvidence, highlight, taskStopReason } from '../src/utils/taskEvidence.js';

let vite;
let StepByStep;
let buildAnswerTrace;
before(async () => {
  vite = await createServer({ configFile: false, server: { middlewareMode: true, ws: false, watch: null }, appType: 'custom' });
  ({ StepByStep } = await vite.ssrLoadModule('/src/components/chat/AnswerTimeline.jsx'));
  ({ buildAnswerTrace } = await vite.ssrLoadModule('/src/utils/answerTrace.js'));
});
after(async () => vite?.close());

const marked = (result) => result.segments.filter((segment) => segment.marked).map((segment) => segment.text);
const joined = (result) => result.segments.map((segment) => segment.text).join('');

const TEXT = 'Alpha line one.\nBeta line two.\nGamma line three.\nDelta line four.';

test('highlight: an exact quote is marked and the rest stays unmarked', () => {
  const result = highlight(TEXT, 'Beta line two.');
  assert.deepEqual(marked(result), ['Beta line two.']);
  assert.equal(result.usedChars, 'Beta line two.'.length);
  assert.equal(result.missingParts, 0);
  assert.equal(joined(result), TEXT);
});

test('highlight: two lines that are not next to each other are marked separately', () => {
  const result = highlight(TEXT, 'Alpha line one.\nDelta line four.');
  assert.deepEqual(marked(result), ['Alpha line one.', 'Delta line four.']);
  assert.equal(joined(result), TEXT);
});

test('highlight: "..." splits a quote into the parts that were really written', () => {
  const result = highlight(TEXT, 'Alpha line one. ... Gamma line three.');
  assert.deepEqual(marked(result), ['Alpha line one.', 'Gamma line three.']);
  assert.equal(result.missingParts, 0);
});

test('highlight: different spacing and case still match, with the original text and offsets', () => {
  const result = highlight('First   part\n\tof  the   Passage here', 'first part of THE passage');
  assert.deepEqual(marked(result), ['First   part\n\tof  the   Passage']);
  assert.equal(joined(result), 'First   part\n\tof  the   Passage here');
  assert.equal(result.usedChars, 'First   part\n\tof  the   Passage'.length);
});

test('highlight: a quote that is not in the passage marks nothing and is counted', () => {
  const result = highlight(TEXT, 'Something that was never written');
  assert.equal(result.missingParts, 1);
  assert.equal(result.usedChars, 0);
  assert.deepEqual(marked(result), []);
  assert.equal(joined(result), TEXT);
});

test('highlight: found lines are marked even when another line is missing', () => {
  const result = highlight(TEXT, 'Beta line two.\nNot in this passage at all');
  assert.deepEqual(marked(result), ['Beta line two.']);
  assert.equal(result.missingParts, 1);
});

test('highlight: overlapping and touching quotes merge into one range', () => {
  const overlapping = highlight('one two three four five', 'one two three\nthree four five');
  assert.deepEqual(marked(overlapping), ['one two three four five']);
  const touching = highlight('one two three four', 'one two\nthree four');
  assert.deepEqual(marked(touching), ['one two three four']);
  assert.equal(touching.usedChars, 'one two three four'.length);
});

test('highlight: an empty or too-short quote marks nothing and reports nothing missing', () => {
  for (const quote of ['', '   ', 'ab', '...', null, undefined]) {
    const result = highlight(TEXT, quote);
    assert.deepEqual(marked(result), [], String(quote));
    assert.equal(result.missingParts, 0, String(quote));
    assert.equal(result.usedChars, 0, String(quote));
    assert.equal(joined(result), TEXT);
  }
});

test('stop reasons read in plain words and unknown ones pass through', () => {
  assert.equal(taskStopReason('complete'), 'all tasks answered');
  assert.equal(taskStopReason('round_limit'), 'stopped at the round limit');
  assert.equal(taskStopReason('no_progress'), 'stopped: two rounds without progress');
  assert.equal(taskStopReason('query_planning_failed'), 'query_planning_failed');
  assert.equal(taskStopReason(undefined), null);
});

const passage = (n, extra = {}) => ({
  id: `p${n}`,
  text: `Passage ${n} sentence one.\nPassage ${n} sentence two.\nPassage ${n} sentence three.`,
  documentTitle: `Document ${n}`,
  fileUrl: `https://example.test/${n}.pdf`,
  metadata: { heading_path: ['Part', `Section ${n}`], page_number: n },
  ...extra,
});
const quote = (n, line = 'one') => ({ chunkId: `p${n}`, quote: `Passage ${n} sentence ${line}.` });

const fixture = () => {
  const documents = [1, 2, 3, 4, 5].map((n) => passage(n));
  return [
    { id: 's1', kind: 'status', label: 'Working', event: { type: 'status', message: 'Working' } },
    {
      id: 's2', kind: 'grading_result',
      event: { type: 'grading_result', stopReason: 'round_limit', hopPlan: [{ id: 'h1', task: 'Task A text', dependsOn: [] }], hopProgress: [{ hopId: 'h1', status: 'pending', value: 'old', inputBindings: {}, evidence: [] }] },
    },
    {
      id: 's3', kind: 'search_stop',
      event: {
        type: 'search_stop', rounds: 2, stopReason: 'complete', isComplete: true,
        hopPlan: [
          { id: 'h1', task: 'Task A text', dependsOn: [] },
          { id: 'h2', task: 'Task B text', dependsOn: [] },
          { id: 'h3', task: 'Task C text', dependsOn: ['h1', 'h2'] },
        ],
        hopProgress: [
          { hopId: 'h1', status: 'resolved', value: 'Result A', inputBindings: {}, evidence: [quote(2), quote(5, 'two')] },
          { hopId: 'h2', status: 'resolved', value: 'Result B', inputBindings: {}, evidence: [quote(4)] },
          {
            hopId: 'h3', status: 'resolved', value: 'Result C', inputBindings: { h1: 'Result A', h2: 'Result B' },
            evidence: [quote(4), quote(3), quote(1), quote(2), quote(5), quote(1, 'three')],
          },
        ],
      },
    },
    { id: 's4', kind: 'generation_context', event: { type: 'generation_context', isComplete: true, documents } },
  ];
};

const textOf = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
const render = (steps) => renderToStaticMarkup(createElement(StepByStep, { trace: buildAnswerTrace(steps), steps, streaming: false }));

test('passage numbers follow the order of the answer context, and entries keep their own quote', () => {
  const data = buildTaskEvidence(fixture());
  assert.deepEqual(data.tasks[2].entries.map((entry) => entry.passage.number), [4, 3, 1, 2, 5, 1]);
  assert.equal(data.tasks[0].entries[0].passage.title, 'Document 2');
  assert.equal(data.tasks[0].entries[0].passage.section, 'Section 2');
  assert.equal(data.tasks[0].entries[0].passage.page, 2);
  // Passage 1 quoted twice: each entry marks only its own line.
  const [first, second] = [data.tasks[2].entries[2], data.tasks[2].entries[5]];
  assert.deepEqual(marked(first.match), ['Passage 1 sentence one.']);
  assert.deepEqual(marked(second.match), ['Passage 1 sentence three.']);
});

test('three tasks: "Answered from X of N passages" and one entry per quote', () => {
  const html = render(fixture());
  assert.match(textOf(html), /3 of 3 tasks answered · all tasks answered · 2 rounds/);
  const answered = [...html.matchAll(/Answered from (\d+) of (\d+) passages/g)].map((match) => `${match[1]} of ${match[2]}`);
  assert.deepEqual(answered, ['2 of 5', '1 of 5', '5 of 5']);
  const cards = html.split('<details open="" class="group').slice(1);
  assert.deepEqual(cards.map((card) => (card.match(/characters used/g) ?? []).length), [2, 1, 6]);
  assert.match(html, /Built from the results of[^]*>h1<[^]*>h2</);
  assert.match(html, /Quoted as evidence/);
});

test('the Tasks step sits after the rounds and before the answer', () => {
  const html = render(fixture());
  assert.ok(html.indexOf('3 of 3 tasks answered') > html.indexOf('Round '));
  assert.ok(html.indexOf('3 of 3 tasks answered') < html.indexOf('>Answer</p>'));
});

test('a passage that is missing from the answer context shows "?" and the plain quote', () => {
  const steps = fixture();
  steps[2].event.hopProgress[1].evidence = [{ chunkId: 'gone', quote: 'A quote with no passage' }];
  const html = render(steps);
  assert.match(html, />\?<\/span><blockquote[^>]*>A quote with no passage</);
});

test('a pending task with no evidence says no passage settled it', () => {
  const steps = fixture();
  steps[2].event.hopProgress[1] = { hopId: 'h2', status: 'pending', value: '', inputBindings: {}, evidence: [] };
  const html = render(steps);
  assert.match(html, /PENDING/);
  assert.match(html, /No passage settled this task/);
  assert.match(textOf(html), /2 of 3 tasks answered/);
});

test('passage text is rendered as plain text, never as markup', () => {
  const steps = fixture();
  steps[3].event.documents[0].text = '<img src=x onerror=alert(1)> quoted words here';
  steps[2].event.hopProgress[0].evidence = [{ chunkId: 'p1', quote: 'quoted words here' }];
  const html = render(steps);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('without the last search_stop, the last grading_result is used', () => {
  const steps = fixture().filter((step) => step.kind !== 'search_stop');
  const data = buildTaskEvidence(steps);
  assert.equal(data.tasks.length, 1);
  assert.equal(data.stopReason, 'stopped at the round limit');
  assert.equal(data.rounds, null);
});

test('older messages without the events do not show the step, and do not fail', () => {
  const noPlan = fixture().filter((step) => !['search_stop', 'grading_result'].includes(step.kind));
  const noContext = fixture().filter((step) => step.kind !== 'generation_context');
  const noProgress = fixture();
  delete noProgress[2].event.hopProgress;
  noProgress.splice(1, 1);
  for (const steps of [noPlan, noContext, noProgress, [], undefined]) {
    assert.equal(buildTaskEvidence(steps), null);
  }
  for (const steps of [noPlan, noContext, noProgress]) {
    const html = render(steps);
    assert.doesNotMatch(html, /\d+ of \d+ tasks answered/);
    assert.doesNotMatch(html, /Answered from/);
  }
});

test('each task card has its own button to open it in a larger view', () => {
  const html = render(fixture());
  const buttons = [...html.matchAll(/aria-label="Open (h\d) in a larger view"/g)].map((match) => match[1]);
  assert.deepEqual(buttons, ['h1', 'h2', 'h3']);
  // The button sits beside the summary, so clicking it cannot also fold the card.
  assert.doesNotMatch(html, /<summary[^>]*>(?:(?!<\/summary>)[^])*<button/);
});
