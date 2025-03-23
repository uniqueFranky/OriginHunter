import * as git from '../git/gitAPI';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { parseCodeIntoMethods } from '../parser/tree-sitter';
import { getHistoryFor, MethodLevelHistory } from '../history/codeshovel';
import { filterMethodsByNode, filterMethodsByRange } from '../history/filter';

async function getMethodHistoryFromDetailedOracle(oracleName: string): Promise<[MethodLevelHistory[], MethodLevelHistory]> {
    let ret: MethodLevelHistory[] = [];
    let repo = git.getGitRepo();

    const oracleContent = await fs.readFile(path.join(__dirname, 'block_oracles', 'detail_methods', oracleName), 'utf-8');
    const oracle = JSON.parse(oracleContent);

    const details = oracle['changeHistoryDetails'];
    const commits: string[] = oracle['changeHistory'];
    let firstMethod = undefined;
    const firstFileName = path.join('/Users/franky/Documents/Homework/毕业设计/testcase/', oracle['repositoryName'], oracle['sourceFilePath']);
    const firstContent = await git.getFileContent(repo, oracle['startCommitName'], firstFileName);
    const firstMethods = parseCodeIntoMethods(firstFileName, firstContent);
    for(const fir of firstMethods) {
        if(fir.signature.name === oracle['functionName'] && fir.syntaxNode.startPosition.row >= oracle['functionStartLine'] - 3 && fir.syntaxNode.startPosition.row <= oracle['functionStartLine'] + 3) {
            firstMethod = fir;
            break;
        }
    }

    for(const commitHash of commits) {
        const detail = details[commitHash];
        const type: string = detail['type'];
        let fileName = undefined;
        let methodName = undefined;
        let startLine = undefined;
        if(type.startsWith('Ymul')) {
            fileName = detail['subchanges'][0]['path'];
            methodName = detail['subchanges'][0]['functionName'];
            startLine = detail['subchanges'][0]['functionStartLine'];
        } else {
            fileName = detail['path'];
            methodName = detail['functionName'];
            startLine = detail['functionStartLine'];
        }
        fileName = path.join('/Users/franky/Documents/Homework/毕业设计/testcase/', oracle['repositoryName'], fileName);
        try {
            let fileContent = await git.getFileContent(repo, commitHash, fileName);
            const methods = parseCodeIntoMethods(fileName, fileContent);
            let found = false;
            for(const m of methods) {
                if(m.signature.name === methodName && m.syntaxNode.startPosition.row >= startLine - 3 && m.syntaxNode.startPosition.row <= startLine + 3) {
                    found = true;
                    const commit = await repo.getCommit(commitHash);
                    ret.push(new MethodLevelHistory(commit, m));
                    break;
                }
            }
        } catch(err) {
            console.log(err);
        }
    }
    return [ret, new MethodLevelHistory(await repo.getCommit(oracle['startCommitName']), firstMethod!)];
}


async function getFilteredHistory(original: MethodLevelHistory[], startLine: number, endLine: number): Promise<MethodLevelHistory[]> {
    const document = await vscode.workspace.openTextDocument(original[0].method.container.filePath);
    const filtered = filterMethodsByNode(original, new vscode.Range(document.lineAt(startLine).range.start, document.lineAt(endLine).range.end));
    return filtered;
}


async function singleTest(dir: string, oracleName: string): Promise<[MethodLevelHistory[], MethodLevelHistory[]]> {
    const oracleContent = await fs.readFile(path.join(__dirname, 'block_oracles', dir, oracleName), 'utf-8');
    const oracle = JSON.parse(oracleContent);
    const targetFileName: string = oracle['filePath'];
    const parts = targetFileName.split('/');
    const target = parts[parts.length - 1].split('.')[0];
    const codeshovelOracleName = oracle['repositoryName'] + '-' + target + '-' + oracle['functionName'] + '.json';
    let [original, first] = await getMethodHistoryFromDetailedOracle(codeshovelOracleName);
    original = [first, ...original];
    const filtered = await getFilteredHistory(original, oracle['blockStartLine'], oracle['blockEndLine']);
    return [original, filtered];
}


export async function doBlockTest(): Promise<[MethodLevelHistory[], MethodLevelHistory[]]> {
    const workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : null;
    if(!workspaceFolder) {
        console.log('no opened folder');
        return [[], []];
    }
    let projectName = workspaceFolder.split('/')[workspaceFolder.split('/').length - 1];
    const oraclePath = path.join(__dirname, 'block_oracles/training');
    const oracleFileNames = await fs.readdir(oraclePath);
    console.log(oracleFileNames);
    let tasks = [];
    for(let i = 0; i < oracleFileNames.length; i++) {
        let oracleName = oracleFileNames[i];
        let oracleFilePath = path.join(oraclePath, oracleName);
        let oracleContent = await fs.readFile(oracleFilePath, 'utf-8');
        const oracle = JSON.parse(oracleContent);
        if(oracle['repositoryName'] !== projectName) {
            continue;
        }
        console.log(oracle);
        let out_dir = path.join(__dirname, 'block_oracles', 'hyb_out');
        let out_name = path.join(out_dir, oracleName);
        let task = singleTest('training', oracleName).then(([original, filtered]) => {
            fs.writeFile(out_name, JSON.stringify(filtered.map(f => f.commit.hash)));
        });
        tasks.push(task);
    }
    await Promise.all(tasks);
    console.log('finish');
    return [[], []];
}