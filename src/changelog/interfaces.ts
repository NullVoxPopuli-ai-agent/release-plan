import type { GitHubIssueResponse, GitHubContributor } from './github-api.js';

export interface CommitInfo {
  commitSHA: string;
  /** the repo that the PR number belongs to */
  repo: string;
  message: string;
  date: string;
  issueNumber: string | null;
  githubIssue?: GitHubIssueResponse;
  categories?: string[];
  packages?: string[];
}

export interface Release {
  name: string;
  date: string;
  commits: CommitInfo[];
  contributors?: GitHubContributor[];
}
