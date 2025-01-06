import { parseCodeIntoSyntaxNode } from "../parser/tree-sitter";
import { Method } from "../parser/utils";
import { AptedNode } from "./utils";
import { spawn } from "child_process";
import path from 'path';
import Parser from "tree-sitter";

function convertTreeSitterNode2AptedNode(tsNode: Parser.SyntaxNode, startingId: number): AptedNode {
    let root = new AptedNode(tsNode.type, startingId++);
    if(tsNode.childCount === 0) {
        root = new AptedNode(tsNode.text, startingId);
    }
    for(let i = 0; i < tsNode.childCount; i++) {
        let tsChild = tsNode.child(i);
        if(!tsChild) {
            continue;
        }
        let child = convertTreeSitterNode2AptedNode(tsChild, startingId);
        root.addChild(child);
    }

    return root;
}

function callPythonCLI(aptNode1: AptedNode, aptNode2: AptedNode): Promise<string> {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, 'apted.py');
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


export async function getMappingsBetweenMethods(m1: Method, m2: Method): Promise<({id: number, value: string}[])[]> {
    let root1 = parseCodeIntoSyntaxNode(m1.container.filePath, m1.toString());
    let root2 = parseCodeIntoSyntaxNode(m2.container.filePath, m2.toString());
    let aptNode1 = convertTreeSitterNode2AptedNode(root1, 0);
    let aptNode2 = convertTreeSitterNode2AptedNode(root2, 0);
    try {
        let mappingString = await callPythonCLI(aptNode1, aptNode2);
        let mappings = JSON.parse(mappingString);
        return mappings;
    } catch(err) {
        console.log(err);
        return [];
    }
    
}