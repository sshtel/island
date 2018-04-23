export interface ISession {
  sid: string;
  aid: string;
  aname?: string;
  current?: {
    pid: string;
  };
  publisher: string;
  nx?: {
    accountid: string; // xxxxxxxx@(nx|daum|naver)
    nexonid: string; // for nexon shop API
    channelinguid: string; // for nexon session login
    cc: string;
  };
  tc?: {
    qqid: number;
    fatiguerate: number;
  };
}

export interface ISessionStore {
  getSession(sid: string): Promise<ISession>;
  setSession(sid: string, session: ISession): Promise<ISession>;
  deleteSession(sid: string): Promise<void>;
}
