import * as vscode from 'vscode';
import { Commit, Repository, Change, LogOptions } from './git';

export function getGitRepo(): Repository {
    const gitExtention = vscode.extensions.getExtension('vscode.git');
    if(!gitExtention) {
        throw new Error('No git extention available.');
    }

    const api = gitExtention.exports.getAPI(1);
    const repos = api.repositories;
    if(!repos[0]) {
        throw new Error('No repo available.');
    }

    return repos[0];
}

export function getCommitsIn(repo: Repository): Promise<Commit[]> {
    try {
        const option: LogOptions = {
            maxEntries: 8000
        };
        return repo.log(option);
    } catch(error) {
        throw error;
    }
}

export function getParentCommitOf(commit: Commit): string {
    return commit.parents[0];
}

export async function getDiffBetween(repo: Repository, parent: string, child: string): Promise<Change[]> {
    try {
        return repo.diffBetween(parent, child);
    } catch(error) {
        throw error;
    }
}

export function getFileContent(repo: Repository, commit: string, path: string) {
    return repo.show(commit, path);
}