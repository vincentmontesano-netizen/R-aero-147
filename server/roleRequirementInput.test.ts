import {expect,it} from 'vitest';
import {roleRequirementInput} from '../shared/roleRequirementInput';
it('rejects invalid periods and identifiers, overlong fields and injected destinations', () => {
 const valid = {trainingId:1,periodMonths:24};
 for(const periodMonths of [0,-1,1.5,121,Infinity,NaN]) expect(roleRequirementInput.safeParse({...valid,periodMonths}).success).toBe(false);
 for(const trainingId of [0,-1,1.5,2147483648]) expect(roleRequirementInput.safeParse({...valid,trainingId}).success).toBe(false);
 for(const patch of [{label:'a'.repeat(256)},{jobTitleContains:'a'.repeat(129)},{licenseCategoryContains:'a'.repeat(65)},{companyId:42}]) expect(roleRequirementInput.safeParse({...valid,...patch}).success).toBe(false);
 expect(roleRequirementInput.parse({...valid,label:'  Maintenance  '})).toEqual({...valid,label:'Maintenance'});
 for(const periodMonths of [1,120]) expect(roleRequirementInput.safeParse({...valid,periodMonths}).success).toBe(true);
});
