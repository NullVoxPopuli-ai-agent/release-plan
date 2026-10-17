import fs from 'node:fs';
import path from 'node:path';
import hostedGitInfo from 'hosted-git-info';
import { lilconfig } from 'lilconfig';

import ConfigurationError from './configuration-error.js';
import { getRootPath } from './git.js';

export interface PackageLocation {
  name: string;
  /** absolute */
  path: string;
}

export interface Configuration {
  repo: string;
  github?: string;
  rootPath: string;
  labels: { [key: string]: string };
  ignoreCommitters: string[];
  /** GitHub login to the login that gets the credit */
  renameCommitters: { [login: string]: string };
  /** PR numbers in commits up to `commit` belong to `repo` */
  forkedFrom?: { repo: string; commit: string };
  ignoreLabel: string;
  nextVersion: string | undefined;
  wildcardLabel?: string;
  packages: PackageLocation[];
}

export interface ConfigLoaderOptions {
  nextVersion?: string;
  packages?: PackageLocation[];
}

export async function load(
  options: ConfigLoaderOptions = {},
): Promise<Configuration> {
  const rootPath = getRootPath();
  return fromPath(rootPath, options);
}

export async function fromPath(
  rootPath: string,
  options: ConfigLoaderOptions = {},
): Promise<Configuration> {
  const config = fromPackageConfig(rootPath);
  const file = await fromConfigFile(rootPath);
  if (file) {
    for (const name of Object.keys(file.config) as RepoOption[]) {
      if (config[name] !== undefined) {
        throw new ConfigurationError(
          `"${name}" is set in both ${file.name} and package.json. Remove one of them.`,
        );
      }
      Object.assign(config, { [name]: file.config[name] });
    }
  }

  const { github, forkedFrom } = config;
  const nextVersion = options.nextVersion;
  let {
    repo,
    labels,
    ignoreCommitters,
    renameCommitters,
    ignoreLabel,
    wildcardLabel,
  } = config;

  if (!repo) {
    repo = findRepo(rootPath);
    if (!repo) {
      throw new ConfigurationError(
        'Could not infer "repo" from the "package.json" file.',
      );
    }
  }

  if (!labels) {
    labels = {
      breaking: ':boom: Breaking Change',
      enhancement: ':rocket: Enhancement',
      bug: ':bug: Bug Fix',
      documentation: ':memo: Documentation',
      internal: ':house: Internal',
    };
  }

  if (!wildcardLabel) {
    wildcardLabel = `_github-changelog_unlabeled_`;
  }

  if (wildcardLabel && !labels[wildcardLabel]) {
    labels[wildcardLabel] = ':present: Additional updates';
  }

  if (!ignoreCommitters) {
    ignoreCommitters = [];
  }

  if (!renameCommitters) {
    renameCommitters = {};
  }

  if (!ignoreLabel) {
    ignoreLabel = 'ignore';
  }

  return {
    repo,
    nextVersion,
    rootPath,
    labels,
    ignoreCommitters,
    renameCommitters,
    ignoreLabel,
    wildcardLabel,
    packages: options.packages ?? [],
    github,
    forkedFrom,
  };
}

/**
 * Options for the whole repo.
 * The `release-plan` key of each package also holds options for that
 * package, so only these names are read from the root package.json.
 */
const repoOptions = [
  'repo',
  'github',
  'labels',
  'ignoreCommitters',
  'renameCommitters',
  'forkedFrom',
  'ignoreLabel',
  'wildcardLabel',
] as const;

type RepoOption = (typeof repoOptions)[number];

/**
 * Config files for the options of the whole repo, in the repo root.
 *
 * package.json is not in this list.
 * Its "release-plan" key also holds the options of the root package,
 * and lilconfig stops at the first file that it finds.
 */
const configFiles = [
  'release-plan.config.js',
  'release-plan.config.mjs',
  'release-plan.config.cjs',
  'release-plan.config.json',
  '.release-planrc',
  '.release-planrc.json',
];

async function fromConfigFile(
  rootPath: string,
): Promise<{ name: string; config: Partial<Configuration> } | undefined> {
  const result = await lilconfig('release-plan', {
    searchPlaces: configFiles,
    stopDir: rootPath,
    cache: false,
  }).search(rootPath);
  if (!result || result.isEmpty) {
    return;
  }

  const name = path.relative(rootPath, result.filepath);
  const config: unknown = result.config;
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    throw new ConfigurationError(`${name} must export an object of options.`);
  }

  for (const option of Object.keys(config)) {
    if (!(repoOptions as readonly string[]).includes(option)) {
      throw new ConfigurationError(
        `"${option}" in ${name} is not an option for the whole repo. Options for one package go in the "release-plan" key of its package.json.`,
      );
    }
  }

  return { name, config };
}

function fromPackageConfig(rootPath: string): Partial<Configuration> {
  const pkgPath = path.join(rootPath, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return {};
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  if (pkg.changelog) {
    console.warn(
      'The "changelog" key in package.json is deprecated. Move its options into the "release-plan" key.',
    );
  }

  if (
    pkg.changelog?.cacheDir !== undefined ||
    pkg['release-plan']?.cacheDir !== undefined
  ) {
    console.warn(
      'The "cacheDir" option does nothing and can be removed from package.json.',
    );
  }

  const config: Partial<Configuration> = {};
  for (const source of [pkg.changelog, pkg['release-plan']]) {
    for (const name of repoOptions) {
      if (source?.[name] !== undefined) {
        config[name] = source[name];
      }
    }
  }
  return config;
}

function findRepo(rootPath: string): string | undefined {
  const pkgPath = path.join(rootPath, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return;
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (!pkg.repository) {
    return;
  }

  return findRepoFromPkg(pkg);
}

export function findRepoFromPkg(pkg: {
  repository: { url: string } | string;
}): string | undefined {
  const url =
    typeof pkg.repository === 'string' ? pkg.repository : pkg.repository.url;
  const info = hostedGitInfo.fromUrl(url);
  if (info && info.type === 'github') {
    return `${info.user}/${info.project}`;
  }
  // hosted-git-info does not know self-hosted GitHub domains
  const matchHttps = /https:\/\/[^/]+\/([^/]+)\/([^/]+)\.git/.exec(url);
  if (matchHttps && matchHttps.length === 3) {
    return `${matchHttps[1]}/${matchHttps[2]}`;
  }
  const matchGit = /git@[^:]+:([^/]+)\/([^/]+)\.git/.exec(url);
  if (matchGit && matchGit.length === 3) {
    return `${matchGit[1]}/${matchGit[2]}`;
  }
}
