import {expect,it} from 'vitest';
import {rolePeriodOverlaps} from '../shared/rolePeriodOverlaps';

it('finds different periods only for the same course and overlapping active employees',()=>{
 const employees=[{jobTitle:'Engineer',licenseCategories:'B1',isActive:true},{jobTitle:'Planner',licenseCategories:'B1',isActive:true},{jobTitle:'Engineer',licenseCategories:'B2',isActive:false},{jobTitle:'Engineer',licenseCategories:null,isActive:null}];
 const draft={trainingId:10,periodMonths:12,jobTitleContains:'engineer'};
 const rules=[
  {id:1,trainingId:10,periodMonths:24,licenseCategoryContains:'b1'},
  {id:2,trainingId:10,periodMonths:12},
  {id:3,trainingId:11,periodMonths:24},
  {id:4,trainingId:10,periodMonths:24,jobTitleContains:'planner'},
  {id:5,trainingId:10,periodMonths:24,licenseCategoryContains:'b2'},
  {id:6,trainingId:10,periodMonths:24,archivedAt:new Date()},
  {id:7,trainingId:10,periodMonths:36},
 ];
 expect(rolePeriodOverlaps(employees,rules,draft)).toEqual([{id:1,periodMonths:24,employeeCount:1},{id:7,periodMonths:36,employeeCount:2}]);
 expect(rolePeriodOverlaps([],rules,draft)).toEqual([]);
 expect(rolePeriodOverlaps(employees,rules,{...draft,jobTitleContains:'absent'})).toEqual([]);
});
