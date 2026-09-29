import type { ChildProcess } from 'node:child_process';
import type { Server } from 'node:http';

export default function globalTeardown() {
  const global = globalThis as {
    __SERVIDOR_TESTE__?: ChildProcess;
    __GOOGLE_FALSO__?: Server;
  };
  global.__SERVIDOR_TESTE__?.kill();
  global.__GOOGLE_FALSO__?.close();
}
