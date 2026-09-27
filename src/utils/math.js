/**
 * LaTeX in an answer, turned into something readable.
 *
 * The model reaches for maths notation unprompted — a percentage share comes
 * back as `\[ \frac{188}{488.9} \times 100 \approx 38.5\% \]`. Markdown has no
 * idea what that is: it escapes the `\[` into a bare `[` and prints the rest
 * verbatim, so the reader gets `[ \frac{188}{488.9} ... ]` in the middle of a
 * sentence.
 *
 * This rewrites the common subset into plain arithmetic rather than rendering
 * it properly, which would mean a maths typesetter and its fonts. The answers
 * here work in ratios and percentages, and `188 / 488.9 × 100 ≈ 38.5%` says
 * exactly as much as the typeset version would.
 */

/**
 * A fraction's own operands need bracketing once they contain arithmetic of
 * their own, or `\frac{\frac{1}{2}}{4}` flattens to `1 / 2 / 4` and says
 * something else entirely. A plain operand is left bare, since `188 million /
 * 488.9 million` needs no help.
 */
const group = (operand) => (/[/×÷+\-]/.test(operand) ? `(${operand})` : operand);

/** Innermost first: `\text{…}` has to go before `\frac{…}{…}` can match. */
const REWRITES = [
  [/\\(?:text|mathrm|mathbf|mathit|operatorname)\s*\{([^{}]*)\}/g, '$1'],
  [
    /\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,
    (_match, numerator, denominator) => `${group(numerator.trim())} / ${group(denominator.trim())}`,
  ],
  [/\\sqrt\s*\{([^{}]*)\}/g, '√($1)'],
  [/\\left\s*([([|])/g, '$1'],
  [/\\right\s*([)\]|])/g, '$1'],
  [/\\(?:times)\b/g, '×'],
  [/\\(?:cdot)\b/g, '·'],
  [/\\(?:div)\b/g, '÷'],
  [/\\(?:approx)\b/g, '≈'],
  [/\\(?:neq|ne)\b/g, '≠'],
  [/\\(?:leq|le)\b/g, '≤'],
  [/\\(?:geq|ge)\b/g, '≥'],
  [/\\(?:pm)\b/g, '±'],
  [/\\(?:rightarrow|to)\b/g, '→'],
  [/\\(?:%|\$|&|_|#)/g, (match) => match.slice(1)],
  // A digit-grouping comma written LaTeX's way, e.g. `14{,}200` — never
  // legitimate markdown, always a thousands separator kept out of math mode's
  // own comma handling.
  [/\{,\}/g, ','],
  // Spacing commands and the maths line break, none of which survive as text.
  [/\\(?:quad|qquad|,|;|:|!|\\)/g, ' '],
  // A bare backslash before a space or tab, with no command name attached —
  // `\ ` is LaTeX's explicit-space, and nothing else writes a backslash
  // straight into whitespace like that. Newlines are left alone: a backslash
  // at end of line is CommonMark's own hard line break.
  [/\\(?=[ \t])/g, ''],
];

/** Runs every rewrite to a fixed point, without touching surrounding whitespace. */
const applyRewrites = (text) => {
  let out = text;

  // A couple of passes, because one rewrite exposes the next: `\text{}` has to
  // clear out of a `\frac{}{}` before the fraction itself can be read.
  for (let pass = 0; pass < 3; pass += 1) {
    const before = out;
    REWRITES.forEach(([pattern, replacement]) => {
      out = out.replace(pattern, replacement);
    });
    if (out === before) break;
  }

  return out;
};

const toPlainMath = (expression) => applyRewrites(expression).replace(/\s+/g, ' ').trim();

const DISPLAY_MATH = /\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$/g;
const INLINE_MATH = /\\\(([\s\S]*?)\\\)/g;
const FENCED_BLOCK = /(```[\s\S]*?```|~~~[\s\S]*?~~~)/;

/**
 * Backticks, so the calculation lands in the same monospace treatment as any
 * other literal — it reads as something computed rather than as prose.
 */
const asCode = (expression) => {
  const text = toPlainMath(expression);
  return text ? `\`${text}\`` : '';
};

const convert = (markdown) => {
  const delimited = markdown
    .replace(DISPLAY_MATH, (_match, bracketed, dollared) => `\n\n${asCode(bracketed ?? dollared)}\n\n`)
    .replace(INLINE_MATH, (_match, expression) => asCode(expression));

  // Delimiters are not guaranteed — the model just as often drops a LaTeX
  // token straight into a sentence with nothing around it at all, e.g.
  // `14{,}200\ crore`. That is cleaned up in place rather than lifted into a
  // code span, and without the whitespace-collapsing pass `asCode` does,
  // since it is still part of an ordinary sentence, not an isolated formula.
  return applyRewrites(delimited);
};

/**
 * Whatever is inside a fenced block is meant to be shown exactly as written,
 * so it is the one place this must keep its hands off.
 */
export const withPlainMath = (markdown) => {
  if (typeof markdown !== 'string' || !markdown) return markdown;

  return markdown
    .split(FENCED_BLOCK)
    .map((section) => (section.startsWith('```') || section.startsWith('~~~') ? section : convert(section)))
    .join('');
};

export default withPlainMath;
