import * as git from '../git/gitAPI';
import * as vscode from 'vscode';
import { CommitComment, IssueComment, ReviewComment } from './utils';

function getRepoOwner(): string {
    const url = git.getRemoteOrigin(git.getGitRepo());
    const parts = url.split('/');
    return parts[parts.length - 2];
}

function getRepoName(): string {
    const url = git.getRemoteOrigin(git.getGitRepo());
    const parts = url.split('/');
    return parts[parts.length - 1];
}

function getAuth(): string {
    const token = vscode.workspace.getConfiguration('originhunter').get<string>('githubToken');
    if(!token) {
        throw new Error('no github token found');
    }
    return token;
}

async function getOctokit() {
    const octokit = await import('octokit');
    const octo = new octokit.Octokit({
        auth: getAuth()
    });
    return octo;
}

export async function getPRsRelatedToCommit(commit: string): Promise<number[]> {
    try {
        const octokit = await getOctokit();
        const response = await octokit.request('GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls', {
            owner: getRepoOwner(),
            repo: getRepoName(),
            commit_sha: commit,
            headers: {
                'X-GitHub-Api-Version': '2022-11-28'
            }
        });
        return response.data.map(pr => pr.number);
    } catch(err) {
        console.log(err);
    }
    return [];
}

function extractNumberHashtags(input: string): number[] {
    const regex = /#\d+/g;
    const matches = input.match(regex);
    return matches ? matches.map(match => Number(match.slice(1))) : [];
  }

export async function getIssuesRelatedToPR(pr: number): Promise<number[]> {
    try {
        const tb = await getPRTitleAndBody(pr);
        return extractNumberHashtags(tb[1]);
    } catch(err) {
        console.log(err);
    }
    return [];
}

export async function getIssueComments(issue: number): Promise<IssueComment[]> {
    try {
        const octokit = await getOctokit();
        const response = await octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}/comments', {
            owner: getRepoOwner(),
            repo: getRepoName(),
            issue_number: issue,
            headers: {
              'X-GitHub-Api-Version': '2022-11-28'
            }
        });
        return response.data.map(comment => new IssueComment(comment.user!.login, comment.body!, issue));
    } catch(err) {
        console.log(err);
    }
    return [];
}

export async function getCommitComments(commit: string): Promise<CommitComment[]> {
    try {
        const octokit = await getOctokit();
        const response = await octokit.request('GET /repos/{owner}/{repo}/commits/{commit_sha}/comments', {
            owner: getRepoOwner(),
            repo: getRepoName(),
            commit_sha: commit,
            headers: {
              'X-GitHub-Api-Version': '2022-11-28'
            }
        });
        return response.data.map(comment => new CommitComment(comment.user!.login, comment.body, comment.commit_id, comment.path));
    } catch(err) {
        console.log(err);
    }
    return [];
}

export async function getReviewComments(pr: number): Promise<ReviewComment[]> {
    try {
        const octokit = await getOctokit();
        const response = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/comments', {
            owner: getRepoOwner(),
            repo: getRepoName(),
            pull_number: pr,
            headers: {
              'X-GitHub-Api-Version': '2022-11-28'
            }
        });
        return response.data.map(comment => new ReviewComment(comment.user!.login, comment.body, comment.id, comment.in_reply_to_id ?? null, comment.diff_hunk, comment.path, comment.original_commit_id, comment.commit_id));
    } catch(err) {
        console.log(err);
    }
    
    return [];
}

export async function getPRTitleAndBody(pr: number): Promise<string[]> {
    try {
        const octokit = await getOctokit();
        const response = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
            owner: getRepoOwner(),
            repo: getRepoName(),
            pull_number: pr,
            headers: {
              'X-GitHub-Api-Version': '2022-11-28'
            }
        });
        let ret: string[] = [];
        ret.push(response.data.title);
        ret.push(response.data.body ?? '');
        return ret;
    } catch(err) {
        console.log(err);
    }
    return [];
}

export async function getIssueTitleAndBody(issue: number): Promise<string[]> {
    try {
        const octokit = await getOctokit();
        const response = await octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}', {
            owner: getRepoOwner(),
            repo: getRepoName(),
            issue_number: issue,
            headers: {
              'X-GitHub-Api-Version': '2022-11-28'
            }
        });
        let ret: string[] = [];
        ret.push(response.data.title);
        ret.push(response.data.body ?? '');
        return ret;
    } catch(err) {
        console.log(err);
    }
    return [];
}