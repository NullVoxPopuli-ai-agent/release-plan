import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

import { findRepoFromPkg, fromPath } from './configuration.js';
import ConfigurationError from './configuration-error.js';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function writeJson(file: string, content: unknown) {
  fs.writeFileSync(file, JSON.stringify(content));
}

describe('Configuration', function () {
  describe('fromPath', function () {
    let tmpDir: string;

    beforeEach(function () {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'changelog-test-'));
    });

    afterEach(function () {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("reads the options from the 'release-plan' key of 'package.json'", async function () {
      writeJson(path.join(tmpDir, 'package.json'), {
        'release-plan': {
          repo: 'foo/bar',
          ignoreCommitters: ['bot'],
          labels: { feature: ':rocket: Enhancement' },
        },
      });

      const result = await fromPath(tmpDir);
      expect(result.repo).toEqual('foo/bar');
      expect(result.ignoreCommitters).toEqual(['bot']);
      expect(result.labels).toMatchObject({ feature: ':rocket: Enhancement' });
    });

    it('reads only repo options next to the package options of the root package', async function () {
      writeJson(path.join(tmpDir, 'package.json'), {
        'release-plan': {
          repo: 'foo/bar',
          ignore: true,
          semverIncrementAs: { major: 'minor' },
        },
      });

      const result = (await fromPath(tmpDir)) as unknown as Record<
        string,
        unknown
      >;
      expect(result.repo).toEqual('foo/bar');
      expect(result).not.toHaveProperty('ignore');
      expect(result).not.toHaveProperty('semverIncrementAs');
    });

    it("still reads the deprecated 'changelog' key, with a warning", async function () {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      writeJson(path.join(tmpDir, 'package.json'), {
        changelog: { repo: 'foo/bar', ignoreLabel: 'skip' },
      });

      const result = await fromPath(tmpDir);
      expect(result.repo).toEqual('foo/bar');
      expect(result.ignoreLabel).toEqual('skip');
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(
          '"changelog" key in package.json is deprecated',
        ),
      );
      warn.mockRestore();
    });

    it("prefers the 'release-plan' key over the 'changelog' key", async function () {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      writeJson(path.join(tmpDir, 'package.json'), {
        changelog: { repo: 'foo/old', ignoreLabel: 'skip' },
        'release-plan': { repo: 'foo/new' },
      });

      const result = await fromPath(tmpDir);
      expect(result.repo).toEqual('foo/new');
      expect(result.ignoreLabel).toEqual('skip');
      warn.mockRestore();
    });

    it("reads 'renameCommitters' from the 'release-plan' key", async function () {
      writeJson(path.join(tmpDir, 'package.json'), {
        'release-plan': {
          repo: 'foo/bar',
          renameCommitters: { 'NullVoxPopuli-ai-agent': 'NullVoxPopuli' },
        },
      });

      expect((await fromPath(tmpDir)).renameCommitters).toEqual({
        'NullVoxPopuli-ai-agent': 'NullVoxPopuli',
      });
    });

    it("reads 'forkedFrom' from the 'release-plan' key", async function () {
      writeJson(path.join(tmpDir, 'package.json'), {
        'release-plan': {
          repo: 'foo/bar',
          forkedFrom: { repo: 'up/stream', commit: 'abc123' },
        },
      });

      expect((await fromPath(tmpDir)).forkedFrom).toEqual({
        repo: 'up/stream',
        commit: 'abc123',
      });
    });

    it("defaults 'renameCommitters' to an empty object", async function () {
      writeJson(path.join(tmpDir, 'package.json'), {
        'release-plan': { repo: 'foo/bar' },
      });

      expect((await fromPath(tmpDir)).renameCommitters).toEqual({});
    });

    it("warns that 'cacheDir' does nothing", async function () {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      writeJson(path.join(tmpDir, 'package.json'), {
        'release-plan': { repo: 'foo/bar', cacheDir: '.changelog' },
      });

      const result = await fromPath(tmpDir);
      expect(result.repo).toEqual('foo/bar');
      expect(result).not.toHaveProperty('cacheDir');
      expect(warn).toHaveBeenCalledWith(
        'The "cacheDir" option does nothing and can be removed from package.json.',
      );
      warn.mockRestore();
    });

    it("reads repo options from 'release-plan.config.mjs'", async function () {
      writeJson(path.join(tmpDir, 'package.json'), {
        repository: 'https://github.com/foo/bar',
        'release-plan': { ignore: true },
      });
      fs.writeFileSync(
        path.join(tmpDir, 'release-plan.config.mjs'),
        `export default {
          renameCommitters: { 'NullVoxPopuli-ai-agent': 'NullVoxPopuli' },
          labels: { bugfix: ':bug: Bug Fix' },
        };`,
      );

      const result = await fromPath(tmpDir);
      expect(result.repo).toEqual('foo/bar');
      expect(result.renameCommitters).toEqual({
        'NullVoxPopuli-ai-agent': 'NullVoxPopuli',
      });
      expect(result.labels).toMatchObject({ bugfix: ':bug: Bug Fix' });
    });

    it("reads repo options from '.release-planrc.json'", async function () {
      writeJson(path.join(tmpDir, 'package.json'), {});
      writeJson(path.join(tmpDir, '.release-planrc.json'), { repo: 'foo/rc' });

      expect((await fromPath(tmpDir)).repo).toEqual('foo/rc');
    });

    it('combines the config file with the release-plan key', async function () {
      writeJson(path.join(tmpDir, 'package.json'), {
        'release-plan': { repo: 'foo/bar' },
      });
      writeJson(path.join(tmpDir, 'release-plan.config.json'), {
        ignoreLabel: 'skip',
      });

      const result = await fromPath(tmpDir);
      expect(result.repo).toEqual('foo/bar');
      expect(result.ignoreLabel).toEqual('skip');
    });

    it('throws when the config file and package.json set the same option', async function () {
      writeJson(path.join(tmpDir, 'package.json'), {
        'release-plan': { repo: 'foo/bar' },
      });
      writeJson(path.join(tmpDir, 'release-plan.config.json'), {
        repo: 'foo/other',
      });

      await expect(fromPath(tmpDir)).rejects.toThrowError(
        '"repo" is set in both release-plan.config.json and package.json. Remove one of them.',
      );
    });

    it('throws for an option of one package in the config file', async function () {
      writeJson(path.join(tmpDir, 'package.json'), {
        repository: 'https://github.com/foo/bar',
      });
      writeJson(path.join(tmpDir, 'release-plan.config.json'), {
        ignore: true,
      });

      await expect(fromPath(tmpDir)).rejects.toThrowError(
        '"ignore" in release-plan.config.json is not an option for the whole repo.',
      );
    });

    it('throws when the config file is not an object', async function () {
      writeJson(path.join(tmpDir, 'package.json'), {
        repository: 'https://github.com/foo/bar',
      });
      writeJson(path.join(tmpDir, 'release-plan.config.json'), ['foo/bar']);

      await expect(fromPath(tmpDir)).rejects.toThrowError(
        'release-plan.config.json must export an object of options.',
      );
    });

    it('does not read a config file above the repo root', async function () {
      const root = path.join(tmpDir, 'repo');
      fs.mkdirSync(root);
      writeJson(path.join(root, 'package.json'), {
        repository: 'https://github.com/foo/bar',
      });
      writeJson(path.join(tmpDir, 'release-plan.config.json'), {
        repo: 'foo/parent',
      });

      expect((await fromPath(root)).repo).toEqual('foo/bar');
    });

    it("does not read 'lerna.json'", async function () {
      writeJson(path.join(tmpDir, 'lerna.json'), {
        changelog: { repo: 'foo/lerna' },
      });
      writeJson(path.join(tmpDir, 'package.json'), {
        repository: 'https://github.com/foo/package',
      });

      expect((await fromPath(tmpDir)).repo).toEqual('foo/package');
    });

    it("throws ConfigurationError if 'package.json' does not exist", async function () {
      await expect(fromPath(tmpDir)).rejects.toThrowError(ConfigurationError);
    });

    it('takes the next version from the caller only', async function () {
      writeJson(path.join(tmpDir, 'package.json'), {
        'release-plan': { repo: 'foo/bar', nextVersion: 'next' },
      });

      expect((await fromPath(tmpDir)).nextVersion).toBeUndefined();
      expect(
        (await fromPath(tmpDir, { nextVersion: 'Release' })).nextVersion,
      ).toEqual('Release');
    });

    it('fills in the default labels and ignores no committers', async function () {
      writeJson(path.join(tmpDir, 'package.json'), {
        'release-plan': { repo: 'foo/bar' },
      });
      const result = await fromPath(tmpDir);
      expect(result.labels).toEqual({
        breaking: ':boom: Breaking Change',
        enhancement: ':rocket: Enhancement',
        bug: ':bug: Bug Fix',
        documentation: ':memo: Documentation',
        internal: ':house: Internal',
        '_github-changelog_unlabeled_': ':present: Additional updates',
      });
      expect(result.ignoreLabel).toEqual('ignore');
      expect(result.ignoreCommitters).toEqual([]);
    });
  });

  describe('findRepoFromPkg', function () {
    const tests = [
      [
        'git+https://github.com/ember-cli/ember-rfc176-data.git',
        'ember-cli/ember-rfc176-data',
      ],
      [
        'https://github.com/ember-cli/ember-rfc176-data.git',
        'ember-cli/ember-rfc176-data',
      ],
      ['https://github.com/babel/ember-cli-babel', 'babel/ember-cli-babel'],
      ['https://github.com/babel/ember-cli-babel.git', 'babel/ember-cli-babel'],
      [
        'https://github.host.com/babel/ember-cli-babel.git',
        'babel/ember-cli-babel',
      ],
      ['git@github.com:babel/ember-cli-babel.git', 'babel/ember-cli-babel'],
      [
        'git@github.host.com:babel/ember-cli-babel.git',
        'babel/ember-cli-babel',
      ],
      ['https://github.com/emberjs/ember.js.git', 'emberjs/ember.js'],
      ['https://gitlab.com/gnachman/iterm2.git', 'gnachman/iterm2'],
      ['git@gitlab.com:gnachman/iterm2.git', 'gnachman/iterm2'],
    ];

    tests.forEach(([input, output]) => {
      it(`'${input}' -> '${output}'`, async function () {
        expect(
          findRepoFromPkg({
            repository: {
              url: input,
            },
          }),
        ).toEqual(output);
      });
    });

    it(`works with shorthand 'repository' syntax`, async function () {
      expect(
        findRepoFromPkg({
          repository: 'https://github.com/babel/ember-cli-babel',
        }),
      ).toEqual('babel/ember-cli-babel');
    });
  });
});
