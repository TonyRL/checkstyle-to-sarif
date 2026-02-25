import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, vi } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');
const projectRoot = join(__dirname, '..');

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

// Runs the CLI programmatically, mocking process.argv, stdin, stdout, and stderr
async function runCli(
  args: string[],
  stdinContent?: string
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number | undefined;
}> {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  let exitCode: number | undefined;

  // Mock process methods
  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdoutChunks.push(String(chunk));
    return true;
  });
  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    stderrChunks.push(String(chunk));
    return true;
  });
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number | string | null | undefined) => {
    exitCode = typeof code === 'number' ? code : 0;
    throw new Error(`process.exit(${exitCode})`);
  });

  const origArgv = process.argv;

  if (stdinContent !== undefined) {
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
    // Mock stdin reading
    const { Readable } = await import('node:stream');
    const mockStdin = Readable.from([stdinContent]);
    vi.spyOn(process, 'stdin', 'get').mockReturnValue(mockStdin as any);
  } else {
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
  }

  try {
    process.argv = ['node', 'cli.js', ...args];
    // Re-import the CLI with fresh module state
    // We use a dynamic import with a cache-busting query to avoid module caching
    const { main } = await import(`${projectRoot}/src/cli.ts?t=${Date.now()}` as string).catch(
      () =>
        // Fallback: run cli module directly
        import('../src/cli.js' as string)
    );
    if (typeof main === 'function') {
      await main();
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('process.exit')) {
      // expected
    } else {
      throw err;
    }
  } finally {
    process.argv = origArgv;
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    exitSpy.mockRestore();
    Object.defineProperty(process.stdin, 'isTTY', { value: undefined, configurable: true });
  }

  return {
    stdout: stdoutChunks.join(''),
    stderr: stderrChunks.join(''),
    exitCode,
  };
}

// ─── CLI Integration Tests ────────────────────────────────────────────────────
// These tests use child_process.execFile to test the built CLI
import { execFile as execFileCb } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import * as os from 'node:os';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

async function runBuiltCli(
  args: string[],
  stdinContent?: string
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    const cliPath = join(projectRoot, 'dist', 'cli.js');
    const proc = execFileCb(
      'node',
      [cliPath, ...args],
      { encoding: 'utf-8', timeout: 10000 },
      (err, stdout, stderr) => {
        resolve({
          stdout: stdout ?? '',
          stderr: stderr ?? '',
          code: err ? ((err as NodeJS.ErrnoException & { code?: number }).code ?? 1) : 0,
        });
      }
    );
    if (stdinContent !== undefined && proc.stdin) {
      proc.stdin.write(stdinContent);
      proc.stdin.end();
    }
  });
}

describe('CLI integration (built)', () => {
  it('--input: converts checkstyle.xml file to SARIF on stdout', async () => {
    const inputFile = join(fixturesDir, 'single-error.xml');
    const { stdout, stderr, code } = await runBuiltCli(['--input', inputFile]);

    expect(code).toBe(0);
    expect(stderr).toBe('');

    const sarif = JSON.parse(stdout);
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs[0].results).toHaveLength(1);
  });

  it('-i: short alias for --input works', async () => {
    const inputFile = join(fixturesDir, 'single-error.xml');
    const { stdout, stderr, code } = await runBuiltCli(['-i', inputFile]);

    expect(code).toBe(0);
    const sarif = JSON.parse(stdout);
    expect(sarif.version).toBe('2.1.0');
  });

  it('--output: writes SARIF to file', async () => {
    const tmpDir = mkdtempSync(join(os.tmpdir(), 'sarif-test-'));
    const outputFile = join(tmpDir, 'out.sarif');
    const inputFile = join(fixturesDir, 'single-error.xml');

    try {
      const { code } = await runBuiltCli(['--input', inputFile, '--output', outputFile]);
      expect(code).toBe(0);

      const content = readFileSync(outputFile, 'utf-8');
      const sarif = JSON.parse(content);
      expect(sarif.version).toBe('2.1.0');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('-o: short alias for --output works', async () => {
    const tmpDir = mkdtempSync(join(os.tmpdir(), 'sarif-test-'));
    const outputFile = join(tmpDir, 'out.sarif');
    const inputFile = join(fixturesDir, 'single-error.xml');

    try {
      const { code } = await runBuiltCli(['-i', inputFile, '-o', outputFile]);
      expect(code).toBe(0);

      const content = readFileSync(outputFile, 'utf-8');
      const sarif = JSON.parse(content);
      expect(sarif.version).toBe('2.1.0');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('stdin: reads from stdin when --input is not specified', async () => {
    const xml = loadFixture('single-error.xml');
    const { stdout, code } = await runBuiltCli([], xml);

    expect(code).toBe(0);
    const sarif = JSON.parse(stdout);
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs[0].results).toHaveLength(1);
  });

  it('stdin + --output: reads from stdin and writes to file', async () => {
    const tmpDir = mkdtempSync(join(os.tmpdir(), 'sarif-test-'));
    const outputFile = join(tmpDir, 'out.sarif');
    const xml = loadFixture('valid-checkstyle.xml');

    try {
      const { code } = await runBuiltCli(['--output', outputFile], xml);
      expect(code).toBe(0);

      const content = readFileSync(outputFile, 'utf-8');
      const sarif = JSON.parse(content);
      expect(sarif.version).toBe('2.1.0');
      expect(sarif.runs[0].results).toHaveLength(6);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('exits with code 1 when --input file does not exist', async () => {
    const { stderr, code } = await runBuiltCli(['--input', '/nonexistent/path/file.xml']);

    expect(code).toBe(1);
    expect(stderr).toContain('Cannot read input file');
  });

  it('exits with code 1 for invalid XML', async () => {
    const tmpDir = mkdtempSync(join(os.tmpdir(), 'sarif-test-'));
    const badFile = join(tmpDir, 'bad.xml');

    try {
      writeFileSync(badFile, '<notcheckstyle><broken/>', 'utf-8');
      const { stderr, code } = await runBuiltCli(['--input', badFile]);

      expect(code).toBe(1);
      expect(stderr).toContain('Conversion failed');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('--version flag prints version', async () => {
    const { stdout, code } = await runBuiltCli(['--version']);
    expect(code).toBe(0);
    expect(stdout.trim()).toMatch(/\d+\.\d+\.\d+/);
  });

  it('--help flag prints usage information', async () => {
    const { stdout, code } = await runBuiltCli(['--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('checkstyle-to-sarif');
    expect(stdout).toContain('--input');
    expect(stdout).toContain('--output');
  });
});
