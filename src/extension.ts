// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as git from './git/gitAPI';
import * as parser from './parser/tree-sitter';
import { getHistoryFor, MethodLevelHistory } from './history/codeshovel';

var selectionTimeOut: NodeJS.Timeout;
var historyPanel: vscode.WebviewPanel;
var scriptUri: vscode.Uri;
var vsCodeContext: vscode.ExtensionContext;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "OriginHunter" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('OriginHunter.helloWorld', () => {
        // The code you place here will be executed every time your command is executed
        // Display a message box to the user
        vscode.window.showInformationMessage('Hello World from OriginHunter!');
    });

    context.subscriptions.push(disposable);
    vsCodeContext = context;
    // listen on selection
    const selectionChangeDisposable = vscode.window.onDidChangeTextEditorSelection(didChangeSelection);
    context.subscriptions.push(selectionChangeDisposable);

}


function didChangeSelection(e: vscode.TextEditorSelectionChangeEvent) {
    const selection = e.selections[0];
    if (selection.isEmpty) {
        return;
    }

    // in case of unstable selection
    if(selectionTimeOut) {
        clearTimeout(selectionTimeOut);
    }

    selectionTimeOut = setTimeout(() => {
        const selectedText = e.textEditor.document.getText(selection);
        const fileName = e.textEditor.document.fileName;
        try {
            let methods = parser.parseCode(fileName, selectedText);
            getHistoryFor(methods[0], git.getGitRepo()).then(histories => {
                updateHistoryPanel(histories as MethodLevelHistory[]);
            });
        } catch(error) {
            const msg = error instanceof Error ? error.message : 'Unknown error occured';
            vscode.window.showErrorMessage(msg);
        }
    }, 1000);

    
}

function updateHistoryPanel(history: MethodLevelHistory[]) {
    if(!historyPanel) {
        historyPanel = vscode.window.createWebviewPanel('HistoryPanel', 'HistoryView', vscode.ViewColumn.Beside, {
            enableScripts: true, // 允许 Webview 中的 JavaScript 执行
        });
    }
    scriptUri = historyPanel.webview.asWebviewUri(vscode.Uri.joinPath(vsCodeContext.extensionUri, 'dist', 'bundle.js'));
    historyPanel.webview.html = getHistoryViewContent(scriptUri);
    historyPanel.webview.postMessage({type: "setCodeHistory", codeHistory: history.map(h => ({commit: h.commit, code: h.method.toString()}))});
}


function getHistoryViewContent(scriptUri: vscode.Uri): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Code Viewer</title>
        </head>
        <body>
            <div id="root">nihao</div>
            <script src="${scriptUri}"></script>
        </body>
        </html>
    `;
}


function testGitAPI() {
    const repo = git.getGitRepo();
    git.getCommitsIn(repo).then(commits => {
        git.getDiffBetween(repo, git.getParentCommitOf(commits[0]), commits[0].hash).then(changes => {
            console.log(changes);
            git.getFileContent(repo, commits[0].hash, changes[0].uri.path);
        });
    });
    
}

// This method is called when your extension is deactivated
export function deactivate() {}