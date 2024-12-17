import * as git from '../git/gitAPI';
import * as parser from '../parser/tree-sitter';
import { Method } from '../parser/utils';
import { Commit, Repository } from '../git/git';

class CommitManager {
    commits: Commit[];
    commitMap: Map<string, Commit>;
    current: Commit;
    constructor(commits: Commit[]) {
        this.commits = commits;
        this.commitMap = new Map();
        this.current = commits[0];
        this.commits.forEach(commit => { this.commitMap.set(commit.hash, commit); });
    }

    public getCommitWithHash(hash: string): Commit {
        let ret = this.commitMap.get(hash);
        if(!ret) {
            throw new Error('No such commit.');
        }
        return ret;
    }

    private moveToParent() {
        this.current = this.getCommitWithHash(git.getParentCommitOf(this.current));
    }

    public moveToPrevious(filter?: (arg0: Commit) => boolean): Commit {
        this.moveToParent();
        while(filter && !filter(this.current)) {
            this.moveToParent();
        }
        return this.current;
    }
    
}

export function getHistoryForMethod(repo: Repository, method: Method) {
    git.getCommitsIn(repo).then(commits => {
        let cm = new CommitManager(commits);
    }).catch(error => {
        throw error;
    });
}