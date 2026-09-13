import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import type { User, Affiliation } from "../../drizzle/schema";
import { getUserByOpenId } from "../db";
import { getActiveAffiliations } from "../access";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  // Active affiliations of the current person (per-org role/governance edge). Loaded
  // for authenticated requests; absent in unit-test contexts (treat as []).
  affiliations?: Affiliation[];
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let affiliations: Affiliation[] = [];

  try {
    // Local email/password sessions: verify the signed JWT cookie, then load
    // the user from the database. No external auth server is contacted.
    const cookies = parseCookieHeader(opts.req.headers.cookie ?? "");
    const session = await sdk.verifySession(cookies[COOKIE_NAME]);
    if (session?.openId) {
      const found = await getUserByOpenId(session.openId);
      if (found && found.status === "active" && found.sessionVersion === session.sessionVersion) {
        user = found;
        affiliations = await getActiveAffiliations(found.id);
      }
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
    affiliations = [];
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    affiliations,
  };
}
