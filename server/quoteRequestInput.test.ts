import {expect,it} from 'vitest';
import {quoteRequestInput} from '../shared/quoteRequestInput';
const valid={companyName:' Company ',contactName:' Contact ',contactEmail:' contact@example.com '};
it('normalizes required values and rejects blank, oversized, invalid or injected quote fields',()=>{
 expect(quoteRequestInput.parse(valid)).toEqual({companyName:'Company',contactName:'Contact',contactEmail:'contact@example.com'});
 for(const patch of [{requestId:"not-a-uuid"},{companyName:'  '},{contactName:''},{contactEmail:'invalid'},{companyName:'a'.repeat(256)},{siret:'a'.repeat(21)},{contactName:'a'.repeat(129)},{contactPhone:'a'.repeat(33)},{trainingTypes:'a'.repeat(513)},{message:'a'.repeat(10001)},{employeeCount:0},{employeeCount:-1},{employeeCount:1.5},{employeeCount:2147483648},{userId:1},{status:'accepted'}])expect(quoteRequestInput.safeParse({...valid,...patch}).success).toBe(false);
 expect(quoteRequestInput.safeParse({...valid,employeeCount:1,message:'a'.repeat(10000)}).success).toBe(true);
});
