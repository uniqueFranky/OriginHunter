// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as git from './git/gitAPI';
import * as parser from './parser/tree-sitter';
import { getHistoryFor, MethodLevelHistory } from './history/codeshovel';

var historyPanel: vscode.WebviewPanel | null;
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
    let helloWorldDisposable = vscode.commands.registerCommand('OriginHunter.helloWorld', () => {
        // The code you place here will be executed every time your command is executed
        // Display a message box to the user
        vscode.window.showInformationMessage('Hello World from OriginHunter!');
    });

    context.subscriptions.push(helloWorldDisposable);
    vsCodeContext = context;
    const mineHistoryByMethodNameDisposable = vscode.commands.registerCommand('OriginHunter.mineHistoryByMethodSignature', mineHistoryByMethodSignature);
    context.subscriptions.push(mineHistoryByMethodNameDisposable);
}

function mineHistoryByMethodSignature() {
    let editor = vscode.window.activeTextEditor;
    if(!editor) {
        console.log('no active editor');
        return;
    }
    let selection = editor.selection;
    setHistoryPanelWaiting();
    let fileName = editor.document.fileName;
    let selectedText = editor.document.getText(selection).replaceAll(/\s+/g, ' ').trim();
    try {
        let methods = parser.parseCode(fileName, editor.document.getText());
        // methods.forEach(met => {console.log(met.signature.toString()); console.log(selectedText);});
        methods = methods.filter(met => met.signature.toString().trim() === selectedText);
        if(methods.length !== 1) {
            throw new Error(`multiple or no (${methods.length}) corresponding method found`);
        }
        let method = methods[0];
        getHistoryFor(method, git.getGitRepo()).then(histories => {
            updateHistoryPanel(histories as MethodLevelHistory[]);
        });
    } catch(error) {
        const msg = error instanceof Error ? error.message : 'Unknown error occured';
        vscode.window.showErrorMessage(msg);
    }
}

function createWebviewPanelIfNotExists() {
    if(!historyPanel) {
        historyPanel = vscode.window.createWebviewPanel('HistoryPanel', 'HistoryView', vscode.ViewColumn.Beside, {
            enableScripts: true, // 允许 Webview 中的 JavaScript 执行
        });
    }
    historyPanel.onDidDispose(() => { historyPanel = null; });
    scriptUri = historyPanel.webview.asWebviewUri(vscode.Uri.joinPath(vsCodeContext.extensionUri, 'dist', 'bundle.js'));
    historyPanel.webview.html = getHistoryViewContent(scriptUri);
}

function updateHistoryPanel(history: MethodLevelHistory[]) {
    createWebviewPanelIfNotExists();
    historyPanel!.webview.postMessage({type: "setCodeHistory", codeHistory: history.map(h => ({commit: h.commit, code: h.method.toString(), container: h.method.container.filePath}))});
}

function setHistoryPanelWaiting() {
    createWebviewPanelIfNotExists();
    historyPanel!.webview.postMessage({type: "setWaiting"});
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