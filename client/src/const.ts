import { safeLoginReturn } from "@shared/loginReturn";
export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Local email/password auth: send users to the in-app login page, then back to the page
// they were on (cart, live room, company space…) instead of the generic dashboard.
const currentPath = () => typeof window === "undefined" ? undefined : window.location.pathname + window.location.search + window.location.hash;
export const getLoginUrl = (returnTo: string | undefined = currentPath()) => {
  const target = safeLoginReturn(returnTo);
  return target ? `/login?returnTo=${encodeURIComponent(target)}` : "/login";
};
export const getRegisterUrl = () => "/register";
