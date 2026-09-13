import {it,expect} from 'vitest';
import {certificateStatus} from '../shared/certificateStatus';
it('treats the expiration instant as expired and prioritizes revocation',()=>{
  const now=1000;
  expect(certificateStatus({isValid:true,expiresAt:null},now)).toBe('valid');
  expect(certificateStatus({isValid:true,expiresAt:new Date(1001)},now)).toBe('valid');
  expect(certificateStatus({isValid:true,expiresAt:new Date(1000)},now)).toBe('expired');
  expect(certificateStatus({isValid:false,expiresAt:new Date(999)},now)).toBe('revoked');
  expect(certificateStatus({isValid:null,expiresAt:null},now)).toBe('revoked');
});
