/** Keep answer positions stable: incomplete options must never be silently removed. */
export function prepareChoiceAnswers(type: string, options: string[], correct: number[]) {
  const cleaned = options.map(option => option.trim());
  if (cleaned.length < 2 || cleaned.some(option => !option) || (type === 'true_false' && cleaned.length !== 2)) return { ok: false, reason: 'options' } as const;
  if (!correct.length || new Set(correct).size !== correct.length || correct.some(index => !Number.isInteger(index) || index < 0 || index >= cleaned.length) || (type !== 'qcm' && correct.length !== 1)) return { ok: false, reason: 'correct' } as const;
  return { ok: true, options: cleaned, correctAnswer: [...correct].sort((a, b) => a - b) } as const;
}

export function prepareMatchingAnswers(options: string[], optionsRight: string[], pairs: number[][]) {
  const left = options.map(option => option.trim()), right = optionsRight.map(option => option.trim());
  if (left.length < 2 || right.length < 2 || [...left, ...right].some(option => !option)) return { ok: false, reason: 'options' } as const;
  if (pairs.length !== left.length || new Set(pairs.map(pair => pair[0])).size !== left.length || pairs.some(pair => pair.length !== 2 || !Number.isInteger(pair[0]) || !Number.isInteger(pair[1]) || pair[0] < 0 || pair[0] >= left.length || pair[1] < 0 || pair[1] >= right.length)) return { ok: false, reason: 'pairs' } as const;
  return { ok: true, options: left, optionsRight: right, pairs: pairs.map(pair => [...pair]) } as const;
}

export function removeMatchingOption(pairs: number[][], index: number, side: 0 | 1) {
  return pairs.filter(pair => pair[side] !== index).map(pair => pair.map((value, column) => column === side && value > index ? value - 1 : value));
}
