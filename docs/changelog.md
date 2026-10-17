# Changelog

Release Plan generates a changelog from the titles of your pull requests.
The generator is a port of [`github-changelog`](https://github.com/release-plan/github-changelog).

Release Plan reads the git history of each published package.
For each package, it lists the pull requests that changed files in that package after its last release.
A pull request that changes no published package does not appear, and it does not need a label.

To find the last release of a package, Release Plan uses the first of these that it finds:

1. The git tag that `release-plan publish` made for the current version
2. The `gitHead` that npm recorded for the current version
3. The commit that set the current version in `package.json`

If npm does not have the current version, all of the history of the package is unreleased.

A pull request needs one of these labels to appear:

- `breaking` (:boom: Breaking Change)
- `enhancement` (:rocket: Enhancement)
- `bug` (:bug: Bug Fix)
- `documentation` (:memo: Documentation)
- `internal` (:house: Internal)

## Configuration

These options apply to the whole repo.
Put them in one of these places in the repo root:

- A config file: `release-plan.config.js`, `release-plan.config.mjs`, `release-plan.config.cjs`, `release-plan.config.json`, `.release-planrc`, or `.release-planrc.json`.
  A JS file must have a default export.
- The `release-plan` key of the root `package.json`.

```js
// release-plan.config.mjs
export default {
  labels: {
    breaking: ':boom: Breaking Change',
    enhancement: ':rocket: Enhancement',
    bug: ':bug: Bug Fix',
    // some PRs use this label for bug fixes
    bugfix: ':bug: Bug Fix',
    documentation: ':memo: Documentation',
    internal: ':house: Internal',
  },
};
```

You can use both places, but not for the same option.
If both set an option, Release Plan stops with an error.
Options for one package, such as `ignore` and `files`, go in the `release-plan` key of the `package.json` of that package.
So a config file can hold only the options below.

The supported options are:

- `repo`: Your "org/repo" on GitHub
  (automatically inferred from the `package.json` file)

- `github`: the github domain, default: github.com

- `labels`: GitHub PR labels mapped to changelog section headers.
  The header sets the impact of the PR:
  `:boom: Breaking Change` is major, `:rocket: Enhancement` is minor, and `:bug: Bug Fix`, `:memo: Documentation` and `:house: Internal` are patch.
  Several labels can share one header, and the changelog shows that section once.
  If you set `labels`, it replaces the default list, so include every label that you use.
  For example:

  ```json
  "labels": {
    "breaking": ":boom: Breaking Change",
    "enhancement": ":rocket: Enhancement",
    "bug": ":bug: Bug Fix",
    "bugfix": ":bug: Bug Fix",
    "documentation": ":memo: Documentation",
    "internal": ":house: Internal"
  }
  ```

- `wildcardLabel`: A label to identify commits that don't have a GitHub PR label
  which matches a value in `labels`. (e.g. `unlabeled`) By default, this has no
  value. [Read more about this option](#wildcardlabel).

- `ignoreCommitters`: List of committers to ignore (exact or partial match).
  A PR from one of them is left out, unless it has one of the `labels`.
  The `wildcardLabel` does not count.
  The default is an empty list, so PRs from bots such as `dependabot[bot]` count like other PRs.

- `renameCommitters`: An object that renames PR authors.
  Each key is the GitHub login of an author, and the value is the login to show instead.
  For example, if a bot opens PRs for a person, map the bot to the person who owns it:
  `{ "NullVoxPopuli-ai-agent": "NullVoxPopuli" }`.
  The PR links to the new login, and the "Committers" list shows the new login.
  The match ignores case.
  `ignoreCommitters` sees the new login.

- `forkedFrom`: For a fork, the repo it came from and the last commit from that repo, for example
  `{ "repo": "release-plan/release-plan", "commit": "463c448..." }`.
  PR numbers in that commit and the commits before it belong to the other repo, so release-plan looks them up and links them there.
  The commit must be in the clone, so CI must fetch the full history.

Older versions read these options from a `changelog` key.
Release Plan still reads that key, but it prints a warning.
If both keys set an option, the `release-plan` key wins.

### `wildcardLabel`

For some projects, it may be beneficial to list PRs in the changelog that don't
have a matching label defined in the configuration `labels`. Listing these PRs also allows you to review the changelog and identify any PRs that should be re-labeled on GitHub. For example, forgetting to label a breaking change.

```json5
{
  // ...
  "release-plan": {
    "wildcardLabel": "unlabeled"
  }
}
```

A default changlog heading of `:present: Additional updates` is set when a value for `wildcardLabel` is in the configuration.

```md
## Unreleased (2018-05-24)

#### 🎁 Additional updates
* [#514](https://github.com/my-org/my-repo/pull/514) Setting to mute video ([@diligent-developer](https://github.com/diligent-developer))
```

You can overwrite the default heading by including the `wildcardLabel` value in the configuration's `labels` object. For example:

```json5
{
  // ...
  "release-plan": {
    "labels": {
      "feature": "New Feature",
      "bug": "Bug Fix",
      "unlabeled": "Unlabeled PRs"
    },
    "wildcardLabel": "unlabeled"
  }
}
```
