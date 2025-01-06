import * as git from '../git/gitAPI';
import { Repository, Commit, Change, Status } from '../git/git';
import { Method } from "../parser/utils";
import { CommitManager, History, jaroWinklerDistance } from "./utils";
import * as parser from '../parser/tree-sitter';
import * as chat from '../chat/api';

function findIdenticalMethodInFile(methods: Method[], target: Method): boolean {
    for(let i = 0; i < methods.length; i++) {
        if(methods[i].equals(target)) {
            return true;
        }
    }
    return false;
}


function findModifiedWithinFile(methods: Method[], target: Method): Method | undefined {
    let ret: Method | undefined = undefined;
    let max = 0;
    for(let i = 0; i < methods.length; i++) {
        let bodySim = jaroWinklerDistance(target.body, methods[i].body);
        let sigSim = jaroWinklerDistance(target.signature.toString(), methods[i].signature.toString());
        if(bodySim >= 0.75 && bodySim > max && sigSim >= 0.8) {
            max = bodySim;
            ret = methods[i];
        }
    }
    return ret;
}

async function findModifiedInOtherFile(methods: Method[], target: Method): Promise<Method | undefined> {
    for(let i = 0; i < methods.length; i++) {
        let sigSim = jaroWinklerDistance(methods[i].signature.toString(), target.signature.toString());
        let bodySim = jaroWinklerDistance(methods[i].body, target.body);
        if(sigSim >= 0.8 && bodySim >= 0.8) {
            const ok = await chat.isSameEvolution(target, methods[i]);
            if(ok) {
                return methods[i];
            }
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
            // console.log(cm.current.hash, current.hash);
            let handler = async (change: Change) => {
                let allFiles = new Set<string>;
                changes.forEach((value, _index, _array) => { allFiles.add(value.originalUri.fsPath); });
                switch(change.status) {
                    case Status.INDEX_ADDED:
                        // new file added
                        console.log('index_add');

                        // check if moved from other files
                        // duplicated with "modified" case
                        let found = false;
                        for(const otherFile of allFiles) {
                            if(otherFile === method.container.filePath || !parser.doSupportsFile(otherFile)) {
                                continue;
                            }
                            try {
                                let otherCode = await git.getFileContent(repo, cm.current.hash, otherFile);
                                let otherMethods = parser.parseCodeIntoMethods(otherFile, otherCode);
                                let modifiedInOtherFile = await findModifiedInOtherFile(otherMethods, method);
                                if(modifiedInOtherFile) {
                                    found = true;
                                    console.log('moved from other file');
                                    console.log(otherFile, method.container.filePath);
                                    console.log(otherFile === method.container.filePath);
                                    console.log(modifiedInOtherFile);
                                    histories.push(new MethodLevelHistory(cm.current, modifiedInOtherFile));
                                    console.log('push');
                                    method = modifiedInOtherFile.copy();
                                    break;
                                }
                            } catch(error) {
                                // console.log(error);
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
                        console.log('push');
                        break;

                    case Status.MODIFIED:
                        console.log('modified');
                        let foundInOtherFile = false;
                        try {
                            let code = await git.getFileContent(repo, cm.current.hash, method.container.filePath);
                            let methods: Method[] = parser.parseCodeIntoMethods(method.container.filePath, code);
                            if(findIdenticalMethodInFile(methods, method)) {
                                // unchanged
                                console.log('but method unchanged');
                                histories[histories.length - 1] = new MethodLevelHistory(cm.current, method.copy());
                                break;
                            }
                            let modifiedWithinFile = findModifiedWithinFile(methods, method);
                            if(modifiedWithinFile) {
                                console.log('modified within file');
                                method = modifiedWithinFile.copy();
                                histories.push(new MethodLevelHistory(cm.current, modifiedWithinFile.copy()));
                                console.log('push');
                                break;
                            }
                        } catch(error) {
                            // console.log(error);
                        }
                        
                        let allMethodsInOtherFiles = [];
                        for(const otherFile of allFiles) {
                            if(otherFile === method.container.filePath || !parser.doSupportsFile(otherFile)) {
                                continue;
                            }
                            try {
                                let otherCode = await git.getFileContent(repo, cm.current.hash, otherFile);
                                let otherMethods = parser.parseCodeIntoMethods(otherFile, otherCode);
                                allMethodsInOtherFiles.push(...otherMethods);
                            } catch(error) {
                                // console.log(error);
                            }
                        }
                        let modifiedInOtherFile = await findModifiedInOtherFile(allMethodsInOtherFiles, method);
                        if(modifiedInOtherFile) {
                            console.log('modified in other file');
                            histories.push(new MethodLevelHistory(cm.current, modifiedInOtherFile));
                            console.log('push');
                            method = modifiedInOtherFile.copy();
                            foundInOtherFile = true;
                            break;
                        }
                        if(!foundInOtherFile) {
                            console.log('introduce');
                            shoudStop = true;
                        }
                        break;
                    default:
                        console.log('unknown status: ', change.status);
                        throw new Error('unknown status');
                }
                
            };

            let hasMatch = false;
            for(let i = 0; i < changes.length; i++) {
                if(changes[i].uri.fsPath === method.container.filePath) {
                    hasMatch = true;
                    await handler(changes[i]);
                }
            }
            current = cm.current;
            if(!hasMatch) {
                histories[histories.length - 1] = new MethodLevelHistory(current, method.copy());
            }
        } catch(error) {
            console.log(error);
            break;
            // TODO: handle error
        }
    }
    return histories;
}