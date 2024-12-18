import * as git from '../git/gitAPI';
import * as parser from '../parser/tree-sitter';
import { Method } from '../parser/utils';
import { Commit, Repository } from '../git/git';

export class CommitManager {
    commits: Commit[];
    commitMap: Map<string, Commit>;
    current: Commit;
    constructor(commits: Commit[]) {
        this.commits = commits;
        this.commitMap = new Map();
        this.current = commits[0];
        this.commits.forEach(commit => { this.commitMap.set(commit.hash, commit); });
        console.log(commits.length);
    }

    public getCommitWithHash(hash: string): Commit {
        let ret = this.commitMap.get(hash);
        if(!ret) {
            throw new Error('No such commit.');
        }
        return ret;
    }

    public moveToParent() {
        this.current = this.getCommitWithHash(git.getParentCommitOf(this.current));
    }
    
}

export abstract class History {
    commit: Commit;
    constructor(commit: Commit) {
        this.commit = commit;
    }
}