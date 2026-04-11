import path from 'path';

/**
 * Runtime path to orchestration/overnight-loop.mjs.
 * Segments are decoded so Turbopack does not treat path.join(cwd, 'orchestration', …) as a bundle import.
 */
export function getOvernightLoopScriptPath(): string {
  const dir = Buffer.from('b3JjaGVzdHJhdGlvbg==', 'base64').toString('utf8');
  const file = Buffer.from('b3Zlcm5pZ2h0LWxvb3AubWpz', 'base64').toString('utf8');
  return path.join(process.cwd(), dir, file);
}
