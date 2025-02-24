import * as git from '../git/gitAPI';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { parseCodeIntoMethods } from '../parser/tree-sitter';
import { getHistoryFor } from '../history/codeshovel';

export async function doTest() {
    console.log('do test');
    let repo = git.getGitRepo();
    const workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : null;
    if(!workspaceFolder) {
        console.log('no opened folder');
        return;
    }
    let projectName = workspaceFolder.split('/')[workspaceFolder.split('/').length - 1];
    const oraclePath = path.join(__dirname, 'oracles/java');
    const oracleFileNames = await fs.readdir(oraclePath);
    console.log(oracleFileNames);
    for(let i = 0; i < oracleFileNames.length; i++) {
        let oracleName = oracleFileNames[i];
        let oracleFilePath = path.join(oraclePath, oracleName);
        let oracleContent = await fs.readFile(oracleFilePath, 'utf-8');
        const oracle = JSON.parse(oracleContent);
        if(oracle['repositoryName'] !== projectName) {
            continue;
        }
        console.log(oracle);
        const relativePath = oracle['filePath'];
        const filePath = path.join(workspaceFolder, relativePath);
        let outName = 'out_' + oracleName;
        const outOraclePath = path.join(__dirname, 'oracles/out/java/new-ds');
        let outPath = path.join(outOraclePath, outName);
        console.log(outPath);
        try {
            const doc = await vscode.workspace.openTextDocument(filePath);
            const content = doc.getText();
            let methods = parseCodeIntoMethods(filePath, content);
            console.log(methods.length);
            for(let i = 0; i < methods.length; i++) {
                if(methods[i].signature.name === oracle['functionName'] && methods[i].syntaxNode.startPosition.row >= oracle['functionStartLine'] - 3 && methods[i].syntaxNode.startPosition.row <= oracle['functionStartLine'] + 3) {
                    let histories = await getHistoryFor(methods[i], repo);
                    let outString = JSON.stringify(histories.map(h => h.commit.hash));
                    // console.log(histories);
                    console.log(outString);
                    await fs.writeFile(outPath, outString);
                    break;
                }
            }
            
        } catch(err) {
            console.log(err);
        }
    }
    
}