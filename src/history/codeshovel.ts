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


async function findModifiedWithinFile(methods: Method[], target: Method): Promise<Method | undefined> {
    // find identical signature
    for(let i = 0; i < methods.length; i++) {
        if(methods[i].signature.equals(target.signature)) {
            return methods[i];
        }
    }

    methods.sort((a, b) => {
        const similarityA = jaroWinklerDistance(target.body, a.body);
        const similarityB = jaroWinklerDistance(target.body, b.body);
        return similarityB - similarityA;// 降序排序（从高到低）
    });
    const candidateNum = 3;
    for(let i = 0; i < candidateNum && i < methods.length; i++) {
        if(await chat.isSameEvolution(target, methods[i])) {
            return methods[i];
        }
    }
    return undefined;
}

async function findModifiedInOtherFile(methods: Method[], target: Method): Promise<Method | undefined> {
    methods.sort((a, b) => {
        const similarityA = jaroWinklerDistance(target.body, a.body);
        const similarityB = jaroWinklerDistance(target.body, b.body);
        return similarityB - similarityA;// 降序排序（从高到低）
    });
    const candidateNum = 3;
    for(let i = 0; i < candidateNum && i < methods.length; i++) {
        if(await chat.isSameEvolution(target, methods[i])) {
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
    cm.moveToParent();
    let histories: History[] = [new MethodLevelHistory(current, method)];
    let shoudStop = false;
    let nextParentId = 1;
    while(!shoudStop) {
        try {   
            let changes = await git.getDiffBetween(repo, cm.current.hash, current.hash);
            // console.log(cm.current.hash, current.hash);
            let handler = async (change: Change) => {
                let allFiles = new Set<string>;
                changes.forEach((value, _index, _array) => { allFiles.add(value.originalUri.fsPath); });
                switch(change.status) {
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
                        try {
                            let code = await git.getFileContent(repo, cm.current.hash, method.container.filePath);
                            let methods: Method[] = parser.parseCodeIntoMethods(method.container.filePath, code);
                            if(findIdenticalMethodInFile(methods, method)) {
                                // unchanged
                                console.log('but method unchanged');
                                histories[histories.length - 1] = new MethodLevelHistory(cm.current, method.copy());
                                break;
                            }
                            let modifiedWithinFile = await findModifiedWithinFile(methods, method);
                            if(modifiedWithinFile) {
                                console.log('modified within file');
                                method = modifiedWithinFile.copy();
                                histories.push(new MethodLevelHistory(cm.current, modifiedWithinFile.copy()));
                                break;
                            }
                        } catch(error) {
                            // console.log(error);
                        }
                        // no break
                    case Status.DELETED:
                    case Status.INDEX_ADDED:
                        let foundInOtherFile = false;
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
                }
            }

            if(hasMatch && nextParentId < current.parents.length) {
                console.log('try other parent ' + nextParentId);
                cm.current = cm.getCommitWithHash(current.parents[nextParentId]);
                nextParentId++;
                continue;
            }

            for(let i = 0; i < changes.length; i++) {
                if(changes[i].uri.fsPath === method.container.filePath) {
                    await handler(changes[i]);
                }
            }

            if(!hasMatch) {
                histories[histories.length - 1] = new MethodLevelHistory(cm.current, method.copy());
            }

            // next iteration``
            nextParentId = 1;
            current = cm.current;
            cm.moveToParent();
            
        } catch(error) {
            console.log(error);
            break;
            // TODO: handle error
        }
    }
    return histories;
}