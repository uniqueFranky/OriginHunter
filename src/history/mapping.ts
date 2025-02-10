import { parseCodeIntoSyntaxNode } from "../parser/tree-sitter";
import { Method } from "../parser/utils";
import { AptedNode, GumtreeNode } from "./utils";
import { spawn } from "child_process";
import path from 'path';
import Parser from "tree-sitter";

export function convertTreeSitterNode2AptedNode(tsNode: Parser.SyntaxNode): AptedNode {
    let root = new AptedNode(tsNode.type, tsNode.id);
    if(tsNode.childCount === 0) {
        root = new AptedNode(tsNode.text, tsNode.id);
    }
    for(let i = 0; i < tsNode.childCount; i++) {
        let tsChild = tsNode.child(i);
        if(!tsChild) {
            continue;
        }
        let child = convertTreeSitterNode2AptedNode(tsChild);
        root.addChild(child);
    }

    return root;
}

export function convertTreeSitterNode2GumtreeNode(tsNode: Parser.SyntaxNode): GumtreeNode {
    let root = new GumtreeNode("", tsNode.type, tsNode.id);
    if(tsNode.childCount === 0) {
        return new GumtreeNode(tsNode.text, tsNode.type, tsNode.id);
    }
    for(let i = 0; i < tsNode.childCount; i++) {
        let tsChild = tsNode.child(i);
        if(!tsChild) {
            continue;
        }
        let child = convertTreeSitterNode2GumtreeNode(tsChild);
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

function callJavaCLI(gumtreeNode1: GumtreeNode, gumtreeNode2: GumtreeNode): Promise<string> {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, 'your-jar-name-1.0-all.jar');
        const pythonProcess = spawn('java', ['-jar', scriptPath, JSON.stringify(gumtreeNode1), JSON.stringify(gumtreeNode2)]);

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


export async function getMappingsBetweenMethods(m1: Method, m2: Method): Promise<(number[])[]> {
    let root1 = m1.syntaxNode;
    let root2 = m2.syntaxNode;
    let n1 = convertTreeSitterNode2GumtreeNode(root1);
    let n2 = convertTreeSitterNode2GumtreeNode(root2);
    try {
        let mappingString = await callJavaCLI(n1, n2);
        let mappings = JSON.parse(mappingString);
        return mappings;
    } catch(err) {
        console.log(err);
        return [];
    }
    
}