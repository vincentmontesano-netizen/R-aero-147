import {expect,it} from 'vitest';
import {ruleMatchesEmployee} from '../shared/roleMatching';
import {roleRequirementInput} from '../shared/roleRequirementInput';

it('uses the same normalized form criteria with either job or licence matching, including empty criteria',()=>{
 const rule=roleRequirementInput.parse({trainingId:1,periodMonths:12,jobTitleContains:'  engineer ',licenseCategoryContains:' B1 '});
 expect(ruleMatchesEmployee({jobTitle:'Lead ENGINEER',licenseCategories:null},rule)).toBe(true);
 expect(ruleMatchesEmployee({jobTitle:'Technician',licenseCategories:'B1.1 / B2'},rule)).toBe(true);
 expect(ruleMatchesEmployee({jobTitle:'Engineer',licenseCategories:'B1'},rule)).toBe(true);
 expect(ruleMatchesEmployee({jobTitle:'Planner',licenseCategories:'B2'},rule)).toBe(false);
 expect(ruleMatchesEmployee({},rule)).toBe(false);
 const all=roleRequirementInput.parse({trainingId:1,periodMonths:12,jobTitleContains:'  ',licenseCategoryContains:''});
 expect(ruleMatchesEmployee({},all)).toBe(true);
 expect(ruleMatchesEmployee({jobTitle:'A_B % inspector'},{jobTitleContains:'_B %'})).toBe(true);
 expect(ruleMatchesEmployee({jobTitle:'AB inspector'},{jobTitleContains:'_B %'})).toBe(false);
});
