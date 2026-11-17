export type RequestContext = {
  request: Request;
  env: Env;
  url: URL;
  path: string;
  getUser: () => Promise<any>;
};
