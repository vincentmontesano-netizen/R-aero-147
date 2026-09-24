export type Answer = string | number[] | number[][];
export type Answers = Record<string, Answer>;
export type AnswerQuestion = { id: number; type: string; options?: string[] | null; optionsRight?: string[] | null };

export function isAnswered(question: AnswerQuestion, answer: Answer | undefined) {
  if (question.type === "free_text") return typeof answer === "string" && answer.trim().length > 0;
  if (question.type === "matching") return Array.isArray(answer) && (question.options ?? []).every((_, left) => answer.some(pair => Array.isArray(pair) && pair[0] === left && Number.isInteger(pair[1]) && pair[1] >= 0 && pair[1] < (question.optionsRight?.length ?? 0)));
  return Array.isArray(answer) && answer.length > 0 && answer.every(value => typeof value === "number");
}

export function selectOption(question: AnswerQuestion, answer: Answer | undefined, index: number): number[] {
  if (question.type !== "qcm") return [index];
  const current = Array.isArray(answer) ? answer.filter((value): value is number => typeof value === "number") : [];
  return current.includes(index) ? current.filter(value => value !== index) : [...current, index];
}

export function selectMatch(answer: Answer | undefined, left: number, right: number): number[][] {
  const current = Array.isArray(answer) ? answer.filter((value): value is number[] => Array.isArray(value)) : [];
  return [...current.filter(pair => pair[0] !== left), [left, right]].sort((a, b) => a[0] - b[0]);
}
