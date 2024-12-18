import * as git from '../git/gitAPI';
import { Repository, Commit, Change, Status } from '../git/git';
import { Method } from "../parser/utils";
import { CommitManager, History } from "./utils";
import * as parser from '../parser/tree-sitter';

function findIdenticalMethodInFile(methods: Method[], target: Method): boolean {
    for(let i = 0; i < methods.length; i++) {
        if(methods[i].equals(target)) {
            console.log(methods[i]);
            console.log(target);
            return true;
        }
    }
    return false;
}


function jaroDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0) {
      return len2 === 0 ? 1 : 0;
  }
  if (len2 === 0) {
      return 0;
  }

  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;

  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  for (let i = 0; i < len1; i++) {
      for (let j = Math.max(0, i - matchDistance); j < Math.min(len2, i + matchDistance + 1); j++) {
          if (s1[i] === s2[j] && !s2Matches[j]) {
              s1Matches[i] = true;
              s2Matches[j] = true;
              matches++;
              break;
          }
      }
  }

  if (matches === 0) {
      return 0;
  }

  let transpositions = 0;
  let point = 0;
  for (let i = 0; i < len1; i++) {
      if (s1Matches[i]) {
          while (!s2Matches[point]) {
              point++;
          }
          if (s1[i] !== s2[point]) {
              transpositions++;
          }
          point++;
      }
  }

  return (
      (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3
  );
}

function jaroWinklerDistance(s1: string, s2: string, p: number = 0.1, maxPrefix: number = 4): number {
  const jaroDist = jaroDistance(s1, s2);
  if (jaroDist > 0.7) {
      let prefixLength = 0;
      for (let i = 0; i < Math.min(s1.length, s2.length, maxPrefix); i++) {
          if (s1[i] === s2[i]) {
              prefixLength++;
          } else {
              break;
          }
      }
      return jaroDist + prefixLength * p * (1 - jaroDist);
  } else {
      return jaroDist;
  }
}

// 示例使用
const str1 = "MARTHA";
const str2 = "MARHTA";
console.log("Jaro-Winkler Distance:", jaroWinklerDistance(str1, str2));

function findModifiedWithinFile(methods: Method[], target: Method): Method | undefined {
    for(let i = 0; i < methods.length; i++) {
        let sim = jaroWinklerDistance(target.body, methods[i].body);
        if(sim >= 0.75) {
            console.log(target.body);
            console.log(methods[i].body);
            console.log(sim);
            return methods[i];
        }
    }
    return undefined;
}

function findModifiedInOtherFile(methods: Method[], target: Method): Method | undefined {
  for(let i = 0; i < methods.length; i++) {
      let sigSim = jaroWinklerDistance(methods[i].signature.toString(), target.signature.toString());
      let bodySim = jaroWinklerDistance(methods[i].body, target.body);
      console.log(sigSim, bodySim);
      if(sigSim >= 0.8 && bodySim >= 0.5) {
        return methods[i];
      }
  }
  return undefined;
}

export class MethodLevelHistory extends History {
    method: Method;
    constructor(commit: Commit, method: Method) {
        super(commit);
        this.method = method;
    }
}

export async function getHistoryFor(method: Method, repo: Repository): Promise<History[]> {
    let commits = await git.getCommitsIn(repo);
    let cm = new CommitManager(commits);
    let current = cm.current;
    let histories: History[] = [new MethodLevelHistory(current, method)];
    let shoudStop = false;
    while(!shoudStop) {
        try {
            cm.moveToParent();
            let changes = await git.getDiffBetween(repo, cm.current.hash, current.hash);
            console.log(cm.current.hash, current.hash);
            let handler = async (change: Change) => {
                if(change.uri.fsPath === method.container.filePath) {
                    let allFiles = new Set<string>;
                    changes.forEach((value, _index, _array) => { allFiles.add(value.uri.fsPath); });
                    switch(change.status) {
                        case Status.INDEX_ADDED:
                            // new file added
                            console.log('index_add');

                            // check if moved from other files
                            // duplicated with "modified" case
                            let found = false;
                            for(const otherFile of allFiles) {
                                if(otherFile === method.container.filePath) {
                                  continue;
                                }
                                let otherCode = await git.getFileContent(repo, cm.current.hash, otherFile);
                                let otherMethods = parser.parseCode(otherFile, otherCode);
                                let modifiedInOtherFile = findModifiedInOtherFile(otherMethods, method);
                                if(modifiedInOtherFile) {
                                  found = true;
                                  console.log('moved from other file');
                                  histories.push(new MethodLevelHistory(cm.current, modifiedInOtherFile));
                                  method = modifiedInOtherFile.copy();
                                  current = cm.current;
                                  break;
                                }
                            }
                            if(!found) {
                                console.log('introduce');
                                shoudStop = true;
                            }
                            break;

                        case Status.INDEX_RENAMED:
                            // file renamed
                            console.log('index_rename');
                            method = method.copy();
                            method.container.filePath = change.originalUri.fsPath;
                            histories.push(new MethodLevelHistory(cm.current, method));
                            current = cm.current;
                            break;

                        case Status.MODIFIED:
                            console.log('modified');
                            let code = await git.getFileContent(repo, cm.current.hash, method.container.filePath);
                            let methods: Method[] = parser.parseCode(method.container.filePath, code);
                            if(findIdenticalMethodInFile(methods, method)) {
                                // unchanged
                                console.log(method.container.filePath);
                                console.log('but method unchanged');
                                break;
                            }
                            let modifiedWithinFile = findModifiedWithinFile(methods, method);
                            if(modifiedWithinFile) {
                                console.log('modified within file');
                                method = modifiedWithinFile.copy();
                                histories.push(new MethodLevelHistory(cm.current, modifiedWithinFile.copy()));
                                current = cm.current;
                                break;
                            }

                            
                            for(const otherFile of allFiles) {
                              if(otherFile === method.container.filePath) {
                                continue;
                              }
                              let otherCode = await git.getFileContent(repo, cm.current.hash, otherFile);
                              let otherMethods = parser.parseCode(otherFile, otherCode);
                              let modifiedInOtherFile = findModifiedInOtherFile(otherMethods, method);
                              if(modifiedInOtherFile) {
                                console.log('modified in other file');
                                histories.push(new MethodLevelHistory(cm.current, modifiedInOtherFile));
                                method = modifiedInOtherFile.copy();
                                current = cm.current;
                                break;
                              }
                            }
                            
                            break;
                        default:
                            console.log('unknown status: ', change.status);
                            throw new Error('unknown status');
                    }
                }
            };
            for(let i = 0; i < changes.length; i++) {
              await handler(changes[i]);
            }
        } catch(error) {
            console.log('end');
            break;
            // TODO: handle error
        }
    }
    return histories;
}