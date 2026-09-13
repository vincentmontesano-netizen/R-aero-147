import { expect, it } from 'vitest';
import { selectLearningEnrollment } from '../shared/learningEnrollment';

it('selects the requested enrollment and its pinned version regardless of list order', () => {
  const older = {id:10,trainingVersionId:1,training:{slug:'human-factors'}};
  const newer = {id:20,trainingVersionId:2,training:{slug:'human-factors'}};
  expect(selectLearningEnrollment([newer,older],'human-factors','enrollment=10')).toBe(older);
  expect(selectLearningEnrollment([older,newer],'human-factors','enrollment=20')).toBe(newer);
  expect(selectLearningEnrollment([newer,older],'human-factors','')).toBeUndefined();
  expect(selectLearningEnrollment([older],'human-factors','')).toBe(older);
});

it('does not substitute another enrollment for unavailable, malformed or mismatched selections', () => {
  const entries = [{id:10,training:{slug:'human-factors'}},{id:11,training:null},{id:12,training:{slug:'other'}}];
  for (const search of ['enrollment=99','enrollment=11','enrollment=12','enrollment=0','enrollment=-1','enrollment=10.5','enrollment=1e1','enrollment=010','enrollment=2147483648','enrollment=','enrollment=10&enrollment=10']) {
    expect(selectLearningEnrollment(entries,'human-factors',search)).toBeUndefined();
  }
  expect(selectLearningEnrollment([],'human-factors','enrollment=10')).toBeUndefined();
});
