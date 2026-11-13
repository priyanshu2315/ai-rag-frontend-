import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chatTitleFromQuestion, isDefaultChatTitle } from '../src/utils/chatTitle.js';

test('a short question becomes the title as written, on one line', () => {
  assert.equal(chatTitleFromQuestion('  What is the\n  leave policy? '), 'What is the leave policy?');
});

test('a long question is cut at a word with an ellipsis', () => {
  const title = chatTitleFromQuestion('Summarise every clause about termination, notice periods and severance across all of the signed contracts');
  assert.ok(title.length <= 61, title);
  assert.match(title, /…$/);
  assert.doesNotMatch(title, /\s…$/);
  assert.ok('Summarise every clause about termination, notice periods and severance across all of the signed contracts'.startsWith(title.slice(0, -1)));
});

test('empty input gives an empty title', () => {
  assert.equal(chatTitleFromQuestion('   '), '');
  assert.equal(chatTitleFromQuestion(undefined), '');
});

test('only a missing or placeholder title counts as untitled', () => {
  for (const title of [null, undefined, '', '  ', 'New Conversation', 'new conversation']) assert.equal(isDefaultChatTitle(title), true, String(title));
  assert.equal(isDefaultChatTitle('Leave policy'), false);
});
