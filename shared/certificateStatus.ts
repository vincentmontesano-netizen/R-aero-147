export function certificateStatus(certificate:{isValid:boolean|null;expiresAt:Date|null},now=Date.now()):'valid'|'revoked'|'expired' {
  if(certificate.isValid!==true)return 'revoked';
  if(certificate.expiresAt&&certificate.expiresAt.getTime()<=now)return 'expired';
  return 'valid';
}
