# Changelog

Release Plan generates a changelog from the titles of your pull requests. The
generator is a port of
[`github-changelog`](https://github.com/release-plan/github-changelog).

Release Plan reads the git history of each published package. For each
package, it lists the pull requests that changed files in that package after
the last release of that package. A pull request that changes no published
package does not appear, and it does not need a label.

To find the last release of a package, Release Plan uses the first of these
that it finds:

1. The git tag that `release-plan publish` made for the current version
2. The `gitHead` that npm recorded for the current version
3. The commit that set the current version in `package.json`

If npm does not have the current version, all of the history of the package
is unreleased.

A pull request needs one of these labels to appear:

- `breaking` (:boom: Breaking Change)
- `enhancement` (:rocket: Enhancement)
- `bug` (:bug: Bug Fix)
- `documentation` (:memo: Documentation)
- `internal` (:house: Internal)

## Configuration

Add a `changelog` key to the `package.json` file of your project:

```json5
{
  // ...
  "changelog": {
    "labels": {
      "feature": "New Feature",
      "bug": "Bug Fix"
    }
  }
}
```

The supported options are:

- `repo`: Your "org/repo" on GitHub
  (automatically inferred from the `package.json` file)

- `github`: the github domain, default: github.com

- `nextVersion`: Title for unreleased commits
  (e.g. `Unreleased`)

- `labels`: GitHub PR labels mapped to changelog section headers

- `wildcardLabel`: A label to identify commits that don't have a GitHub PR label
  which matches a value in `labels`. (e.g. `unlabeled`) By default, this has no
  value. [Read more about this option](#wildcardlabel).

- `ignoreCommitters`: List of committers to ignore (exact or partial match).
  The default is an empty list, so PRs from bots such as `dependabot[bot]`
  count like other PRs. A dependency update in a published package then
  causes a release of that package.

- `cacheDir`: Path to a GitHub API response cache to avoid throttling
  (e.g. `.changelog`)

### `wildcardLabel`

For some projects, it may be beneficial to list PRs in the changelog that don't
have a matching label defined in the configuration `labels`. Listing these PRs also allows you to review the changelog and identify any PRs that should be re-labeled on GitHub. For example, forgetting to label a breaking change.

```json5
{
  // ...
  "changelog": {
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
  "changelog": {
    "labels": {
      "feature": "New Feature",
      "bug": "Bug Fix",
      "unlabeled": "Unlabeled PRs"
    },
    "wildcardLabel": "unlabeled"
  }
}
```
