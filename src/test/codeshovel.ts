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
    const prefixes = ['checkstyle', 'commons', 'flink', 'hibernate', 'javaparser', 'jgit', 'junit4', 'junit5', 'okhttp', 'spring', 'Z_commons', 'Z_elastic', 'Z_hadoop', 'Z_hibernate', 'Z_intel', 'Z_jetty', 'Z_lucene', 'Z_mockito', 'Z_pmd', 'Z_spring'];
    const oraclePath = 'oracles/java';
    // const oracleFileNames = await fs.readdir(oraclePath);

    // for(let oracleName in oracleFileNames) {
    //     console.log(oracleName);
    //     if(!oracleName.startsWith(prefixes[prefixes.length - 3])) {
    //         continue;
    //     }
    //     let oracleFilePath = path.join(oraclePath, oracleName);
    //     let oracleContent = await fs.readFile(oracleFilePath, 'utf-8');
    //     const oracle = JSON.parse(oracleContent);
    //     const relativePath = oracle['filePath'];
    //     const filePath = path.join(workspaceFolder, relativePath);
    //     console.log(filePath);
    //     try {
    //         const doc = await vscode.workspace.openTextDocument(filePath);
    //         const content = doc.getText();
    //         let methods = parseCodeIntoMethods(filePath, content);
    //         console.log(methods);
    //         for(let i = 0; i < methods.length; i++) {
    //             if(methods[i].signature.name === 'loadPlugin' && methods[i].syntaxNode.startPosition.row >= 55 - 3 && methods[i].syntaxNode.startPosition.row <= 55 + 3) {
    //                 let histories = await getHistoryFor(methods[i], repo);
    //                 console.log(histories);
    //                 break;
    //             }
    //         }
    //     } catch(err) {
    //         console.log(err);
    //     }
    // }
    
}