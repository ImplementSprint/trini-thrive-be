declare module '@apicenter/sdk' {
  export class TribeClient {
    constructor(options?: Record<string, unknown>);
    authenticate(): Promise<void>;
    [key: string]: (...args: unknown[]) => unknown;
  }
}
