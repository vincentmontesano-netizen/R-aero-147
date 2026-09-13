import {ruleMatchesEmployee} from './roleMatching';

type Criteria = Parameters<typeof ruleMatchesEmployee>[1];
type Rule = Criteria & {id:number;trainingId:number;periodMonths:number;archivedAt?:unknown};
type Employee = Parameters<typeof ruleMatchesEmployee>[0] & {isActive?:boolean|null};

/** Describes overlapping criteria, not the number of future recurrence inserts. */
export function rolePeriodOverlaps(employees:Employee[],rules:Rule[],draft:Criteria & {trainingId:number;periodMonths:number}){
 const matching=employees.filter(employee=>employee.isActive!==false&&ruleMatchesEmployee(employee,draft));
 return rules.filter(rule=>rule.archivedAt==null&&rule.trainingId===draft.trainingId&&rule.periodMonths!==draft.periodMonths)
  .map(rule=>({id:rule.id,periodMonths:rule.periodMonths,employeeCount:matching.filter(employee=>ruleMatchesEmployee(employee,rule)).length}))
  .filter(rule=>rule.employeeCount>0);
}
