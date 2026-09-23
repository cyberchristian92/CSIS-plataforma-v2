import type { ChildProcess } from 'node:child_process';

export default function globalTeardown() {
  (
    globalThis as { __SERVIDOR_TESTE__?: ChildProcess }
  ).__SERVIDOR_TESTE__?.kill();
}
