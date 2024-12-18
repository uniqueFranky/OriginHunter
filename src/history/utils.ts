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

function jaroDistance(s1: string, s2: string): number {
    const len1 = s1.length;
    const len2 = s2.length;
    
    // 如果两个字符串相等，直接返回 1.0
    if (s1 === s2) {
      return 1.0;
    }
  
    // 计算匹配窗口
    const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
    
    let matches = 0;
    let transpositions = 0;
    const s1Matches = new Array(len1).fill(false);
    const s2Matches = new Array(len2).fill(false);
  
    // 第一步：匹配字符
    for (let i = 0; i < len1; i++) {
      const start = Math.max(0, i - matchWindow);
      const end = Math.min(len2 - 1, i + matchWindow);
      
      for (let j = start; j <= end; j++) {
        if (s2Matches[j]) {
          continue;
        }
        if (s1[i] === s2[j]) {
          s1Matches[i] = true;
          s2Matches[j] = true;
          matches++;
          break;
        }
      }
    }
  
    // 如果没有匹配的字符，直接返回 0
    if (matches === 0) {
      return 0;
    }
  
    // 第二步：计算转置数
    let k = 0;
    for (let i = 0; i < len1; i++) {
      if (!s1Matches[i]) {
        continue;
      }
      while (!s2Matches[k]) {
        k++;
      }
      if (s1[i] !== s2[k]) {
        transpositions++;
      }
      k++;
    }
  
    transpositions /= 2;
  
    // 计算 Jaro 距离
    return (matches / len1 + matches / len2 + (matches - transpositions) / matches) / 3;
}
  
export function jaroWinklerDistance(s1: string, s2: string, scalingFactor: number = 0.1): number {
    const jaroDist = jaroDistance(s1, s2);
    
    // 计算共同前缀长度（最多 4 个字符）
    const prefixLength = Math.min(4, Math.min(s1.length, s2.length));
    let prefix = 0;
    
    for (let i = 0; i < prefixLength; i++) {
      if (s1[i] === s2[i]) {
        prefix++;
      } else {
        break;
      }
    }
  
    // 计算 Winkler 距离
    return jaroDist + scalingFactor * prefix * (1 - jaroDist);
}
