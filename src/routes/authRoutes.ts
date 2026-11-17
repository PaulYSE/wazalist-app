import type {
  RequestContext,
} from "../types/request";

export async function handleAuthRoutes(
  ctx: RequestContext,
): Promise<Response | null> {

  const {
    request,
    env,
    path,
    getUser,
  } = ctx;

  return null;
}
