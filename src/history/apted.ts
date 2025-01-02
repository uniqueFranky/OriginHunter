import { spawn } from 'child_process';
import path from 'path';
import Parser from 'tree-sitter';

class AptedNode {
    value: string;
    children: AptedNode[];

    constructor(value: string, children: AptedNode[] = []) {
        this.value = value;
        this.children = children;
    }

    public addChild(child: AptedNode) {
        this.children.push(child);
    }

    public toAptedText(): string {
        if(this.children.length === 0) {
            return `{${this.value}}`;
        } else {
            return `{${this.value}${this.children.map(child => `${child.toAptedText()}`).join('')}}`;
        }
    }
}

function convertTreeSitterNode2AptedNode(tsNode: Parser.SyntaxNode): AptedNode {
    let root = new AptedNode(tsNode.type);
    for(let i = 0; i < tsNode.childCount; i++) {
        let tsChild = tsNode.child(i);
        if(!tsChild) {
            continue;
        }
        let child = convertTreeSitterNode2AptedNode(tsChild);
        root.addChild(child);
    }
    if(tsNode.childCount === 0) {
        root = new AptedNode(tsNode.text);
    }
    return root;
}

export function callPythonCLI(tsNode1: Parser.SyntaxNode, tsNode2: Parser.SyntaxNode): Promise<string> {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, 'apted.py');
        let aptNode1 = convertTreeSitterNode2AptedNode(tsNode1);
        let aptNode2 = convertTreeSitterNode2AptedNode(tsNode2);
        const pythonProcess = spawn('python', [scriptPath, JSON.stringify(aptNode1), JSON.stringify(aptNode2)]);

        let output = '';
        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            reject(data.toString());
        });

        pythonProcess.on('close', () => {
            resolve(output);
        });
    });
}
