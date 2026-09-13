import { expect, it } from 'vitest';
import { gradeQuizAnswer } from './db';
import { isUsableKeyword } from '../shared/freeTextAnswer';
it('never accepts an unrelated answer through an empty normalized keyword', () => {
  for (const keyword of ['', '   ', '\u0301', ' \u0300\u0301 ', null, 42]) {
    expect(isUsableKeyword(keyword)).toBe(false);
    expect(gradeQuizAnswer({type: 'free_text', answerKey: {keywords: [keyword, 'hydraulique']}}, 'pneumatique')).toBe(false);
    expect(gradeQuizAnswer({type: 'free_text', answerKey: {keywords: [keyword, 'hydraulique']}}, 'circuit hydraulique')).toBe(true);
  }
});
it('preserves case, accent, phrase and Arabic keyword matching and rejects blank answers', () => {
  for (const [keyword, answer] of [['électrique', 'Circuit ELECTRIQUE'], ['pression hydraulique', 'La PRESSION HYDRAULIQUE est stable'], ['محرك', 'فحص محرك الطائرة']]) {
    const question = {type: 'free_text', answerKey: {keywords: [keyword]}};
    expect(isUsableKeyword(keyword)).toBe(true);
    expect(gradeQuizAnswer(question, answer)).toBe(true);
    for (const blank of ['', ' ', '\u0301', null]) expect(gradeQuizAnswer(question, blank)).toBe(false);
  }
});
