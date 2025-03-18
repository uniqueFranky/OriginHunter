import { parseCodeIntoSyntaxNode } from "../parser/tree-sitter";
import { Method } from "../parser/utils";
import { AptedNode, GumtreeNode } from "./utils";
import { spawn } from "child_process";
import path from 'path';
import Parser, { SyntaxNode, Point } from "tree-sitter";

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

export async function getMappingsBetweenSyntaxNodes(root1: SyntaxNode, root2: SyntaxNode): Promise<(number[])[]> {
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

export class CodeEditScript {
    type: string;
    val: string;
    src: number;
    dst: number;
    pos: number;
    constructor(type: string, val: string, src: number, dst: number, pos: number) {
        this.type = type;
        this.val = val;
        this.src = src;
        this.dst = dst;
        this.pos = pos;
    }
}

export class CodeDisplay {
    type: string;
    start: Point;
    end: Point;
    constructor(type: string, node: SyntaxNode) {
        this.type = type;
        this.start = node.startPosition;
        this.end = node.endPosition;
    }
}

function getId2NodeMapping4SyntaxNode(current: SyntaxNode): Map<number, SyntaxNode> {
    let ret = new Map<number, SyntaxNode>();
    ret.set(current.id, current);
    current.children.forEach(child => {
        let childMap = getId2NodeMapping4SyntaxNode(child);
        childMap.forEach((v, k) => ret.set(k, v));
    });
    return ret;
}

// TODO: fix me
export async function getHighLight(code1: string, file1: string, code2: string, file2: string): Promise<CodeDisplay[][]> {
    let n1 = parseCodeIntoSyntaxNode(file1, code1);
    let n2 = parseCodeIntoSyntaxNode(file2, code2);
    let id2node1 = getId2NodeMapping4SyntaxNode(n1);
    let id2node2 = getId2NodeMapping4SyntaxNode(n2);
    let nodeMappings = await getMappingsBetweenSyntaxNodes(n1, n2);
    let ret: CodeDisplay[][] = [];
    ret.push([]);
    ret.push([]);
    try {
        let editString = await callEditScriptJavaCLI(convertTreeSitterNode2GumtreeNode(n1), convertTreeSitterNode2GumtreeNode(n2));
        let edits = JSON.parse(editString) as CodeEditScript[];
        edits.forEach(edit => {
            if(edit.type === 'insert') {
                ret[1].push(new CodeDisplay('insert', id2node2.get(edit.src)!));
            } else if(edit.type === 'delete') {
                ret[0].push(new CodeDisplay('delete', id2node1.get(edit.src)!));
            } else if(edit.type === 'move') {
                ret[0].push(new CodeDisplay('move-out', id2node1.get(edit.src)!));
                ret[1].push(new CodeDisplay('move-in', id2node2.get(edit.dst)!.child(edit.pos)!));
            } else if(edit.type === 'update') {
                ret[0].push(new CodeDisplay('update', id2node1.get(edit.src)!));
                for(let unit of nodeMappings) {
                    if(unit[0] === edit.src) {
                        ret[1].push(new CodeDisplay('update', id2node2.get(unit[1])!));
                        break;
                    }
                }
            } else {
                throw new Error('unknown edit type: ' + edit.type);
            }
        });
        
        return [];
    } catch(err) {
        console.log(err);
        return [];
    }
}


async function callEditScriptJavaCLI(gumtreeNode1: GumtreeNode, gumtreeNode2: GumtreeNode): Promise<string> {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, 'edit-script-1.0-all.jar');
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