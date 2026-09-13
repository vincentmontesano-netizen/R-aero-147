import { safeLoginReturn } from "@shared/loginReturn";
export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Local email/password auth: send users to the in-app login page.
export const getLoginUrl = (returnTo?: string) => {
  const target = safeLoginReturn(returnTo);
  return target ? `/login?returnTo=${encodeURIComponent(target)}` : "/login";
};
export const getRegisterUrl = () => "/register";
