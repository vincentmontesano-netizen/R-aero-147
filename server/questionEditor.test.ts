import { expect, it } from 'vitest';
import { prepareChoiceAnswers, prepareMatchingAnswers, removeMatchingOption } from '../shared/questionEditor';

it('rejects blank choices instead of moving a correct index onto a different answer', () => {
  expect(prepareChoiceAnswers('qcu', ['', 'Correct', 'Incorrect'], [1])).toEqual({ ok: false, reason: 'options' });
  expect(prepareChoiceAnswers('qcu', ['  Correct ', 'Incorrect'], [0])).toMatchObject({ ok: true, options: ['Correct', 'Incorrect'], correctAnswer: [0] });
  expect(prepareChoiceAnswers('true_false', ['صحيح', 'خطأ'], [1])).toMatchObject({ ok: true, options: ['صحيح', 'خطأ'], correctAnswer: [1] });
});
it('requires an exact valid correction and does not mutate the draft', () => {
  for (const correct of [[], [-1], [2], [0.5], [0, 0], [0, 1]]) expect(prepareChoiceAnswers('qcu', ['A', 'B'], correct).ok).toBe(false);
  const correct = [1, 0];
  expect(prepareChoiceAnswers('qcm', ['A', 'B'], correct)).toMatchObject({ ok: true, correctAnswer: [0, 1] });
  expect(correct).toEqual([1, 0]);
});
it('refuses incomplete matching columns and missing, duplicate or invalid left assignments', () => {
  expect(prepareMatchingAnswers(['A', '', 'B'], ['X', 'Y'], [[0, 0], [2, 1]]).ok).toBe(false);
  for (const pairs of [[[0, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 2]], [[0, 0], [1, -1]]]) expect(prepareMatchingAnswers(['A', 'B'], ['X', 'Y'], pairs).ok).toBe(false);
  expect(prepareMatchingAnswers([' A ', 'B'], ['X', 'Y'], [[0, 1], [1, 0]])).toMatchObject({ ok: true, options: ['A', 'B'], pairs: [[0, 1], [1, 0]] });
});
it('keeps associations attached to the same labels after deleting either column item', () => {
  const left = ['A', 'B', 'C'], right = ['X', 'Y', 'Z'], pairs = [[0, 2], [1, 0], [2, 1]];
  const afterLeft = left.filter((_, index) => index !== 1);
  expect(removeMatchingOption(pairs, 1, 0).map(([l, r]) => [afterLeft[l], right[r]])).toEqual([['A', 'Z'], ['C', 'Y']]);
  const afterRight = right.filter((_, index) => index !== 0);
  expect(removeMatchingOption(pairs, 0, 1).map(([l, r]) => [left[l], afterRight[r]])).toEqual([['A', 'Z'], ['C', 'Y']]);
  expect(pairs).toEqual([[0, 2], [1, 0], [2, 1]]);
});
