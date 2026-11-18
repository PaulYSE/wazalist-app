export interface RequestContext {
  request: Request;
  env: Env;
  url: URL;
  path: string;

  getUser: () =>
    Promise<User | null> | null;

  getGroupRole: (
    groupId: number,
    userId: number,
  ) => Promise<string | null>;
}
