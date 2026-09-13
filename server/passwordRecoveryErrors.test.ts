import { afterEach, expect, it, vi } from 'vitest';
import * as auth from './auth';
import { appRouter } from './routers';

afterEach(() => vi.restoreAllMocks());
const caller = () => appRouter.createCaller({user:null,req:{headers:{}} as never,res:{} as never});
const input = {token:'isolated-reset-token-fixture',password:'isolated-password-fixture'};

it('returns a stable invalid-link error only for the explicit token failure', async () => {
  vi.spyOn(auth,'resetPasswordWithToken').mockRejectedValue(new auth.InvalidPasswordResetTokenError());
  await expect(caller().auth.resetPassword(input)).rejects.toMatchObject({
    code:'BAD_REQUEST',message:'Lien de réinitialisation invalide ou expiré.',
  });
});

it('does not expose internal exceptions or credentials through the public reset error', async () => {
  const reset = vi.spyOn(auth,'resetPasswordWithToken');
  for (const failure of [new Error('SQL fixture details: password=private-fixture token=private-token'), new Error('Lien de réinitialisation invalide ou expiré.'), null]) {
    reset.mockRejectedValueOnce(failure);
    const error = await caller().auth.resetPassword(input).then(() => null, error => error);
    expect(error).toMatchObject({code:'INTERNAL_SERVER_ERROR',message:'Le changement de mot de passe n’a pas pu être confirmé. Réessayez de vous connecter ou demandez un nouveau lien.'});
    expect(error.cause).toBeUndefined();
    expect(JSON.stringify(error)).not.toContain('private-fixture');
    expect(JSON.stringify(error)).not.toContain('private-token');
  }
});
