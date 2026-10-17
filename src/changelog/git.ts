import { execa, execaSync } from 'execa';
import { join } from 'node:path';

export function getRootPath() {
  const cwd = process.cwd();
  return execaSync('git', ['rev-parse', '--show-toplevel'], { cwd }).stdout;
}

export async function changedPaths(sha: string): Promise<string[]> {
  const result = await execa('git', [
    'show',
    '-m',
    '--name-only',
    '--pretty=format:',
    '--first-parent',
    sha,
  ]);
  return result.stdout.split('\n');
}

/**
 * The commit that a tag, sha, or other ref points at,
 * or undefined when the ref does not exist in this clone.
 */
export function commitFor(ref: string): string | undefined {
  const result = execaSync(
    'git',
    ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`],
    { reject: false },
  );
  return result.exitCode === 0 ? result.stdout : undefined;
}

/**
 * Every commit that `ref` can reach, including `ref` itself.
 */
export function commitsUpTo(ref: string): Set<string> {
  const shas = execaSync('git', ['rev-list', ref]).stdout.split('\n');
  return new Set(shas.filter(Boolean));
}

export function isAncestor(ref: string, of: string = 'HEAD'): boolean {
  return (
    execaSync('git', ['merge-base', '--is-ancestor', ref, of], {
      reject: false,
    }).exitCode === 0
  );
}

/**
 * The newest first-parent commit that changed the "version" line
 * of a package.json.
 *
 * A release PR that lands as a merge commit changes the version
 * in a side commit, so merges are diffed against their first parent.
 */
export function lastVersionChange(pkgJSONPath: string): string | undefined {
  const sha = execaSync('git', [
    'log',
    '-1',
    '--first-parent',
    '--diff-merges=first-parent',
    '--no-patch',
    '--format=%H',
    '-G',
    '^[[:space:]]*"version"[[:space:]]*:',
    'HEAD',
    '--',
    pkgJSONPath,
  ]).stdout.trim();
  return sha || undefined;
}

/**
 * Position of each commit on the first-parent chain of HEAD,
 * newest first.
 */
export function firstParentOrder(): Map<string, number> {
  const order = new Map<string, number>();
  const shas = execaSync('git', ['rev-list', '--first-parent', 'HEAD'])
    .stdout.split('\n')
    .filter(Boolean);
  for (let i = 0; i < shas.length; i++) {
    order.set(shas[i], i);
  }
  return order;
}

export interface CommitListItem {
  sha: string;
  refName: string;
  summary: string;
  date: string;
}

export function parseLogMessage(commit: string): CommitListItem | null {
  const parts =
    commit.match(/hash<(.+)> ref<(.*)> message<(.*)> date<(.*)>/) || [];

  if (!parts || parts.length === 0) {
    return null;
  }

  return {
    sha: parts[1],
    refName: parts[2],
    summary: parts[3],
    date: parts[4],
  };
}

/**
 * The git pathspecs for the files of a package that count as changes.
 *
 * `files` holds globs relative to the package folder.
 * A glob that starts with `!` leaves files out.
 * If there is no other glob, the whole folder counts.
 *
 * An exclude pathspec alone matches the whole repo,
 * so the result always has an include pathspec.
 */
export function packagePathspecs(dir: string, files: string[] = []): string[] {
  const include: string[] = [];
  const exclude: string[] = [];

  for (const file of files) {
    if (file.startsWith('!')) {
      exclude.push(`:(glob,exclude)${join(dir, file.slice(1))}`);
    } else {
      include.push(`:(glob)${join(dir, file)}`);
    }
  }

  if (include.length === 0) {
    include.push(dir);
  } else {
    /**
     * A dependency change in package.json must still cause a release.
     */
    include.push(join(dir, 'package.json'));
  }

  return include.concat(exclude);
}

/**
 * First-parent commits after `from` (or all of history when `from` is
 * undefined) up to `to` that change something under `paths`.
 */
export function listCommits(
  from: string | undefined,
  to: string = 'HEAD',
  paths: string[] = [],
): CommitListItem[] {
  // the format is parsed by `parseLogMessage`
  return execaSync('git', [
    'log',
    '--first-parent',
    '--pretty=hash<%H> ref<%D> message<%s> date<%cd>',
    '--date=short',
    from ? `${from}..${to}` : to,
    '--',
    ...paths,
  ])
    .stdout.split('\n')
    .filter(Boolean)
    .map(parseLogMessage)
    .filter(Boolean) as CommitListItem[];
}
