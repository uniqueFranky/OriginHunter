import { parseCodeIntoSyntaxNode } from "../parser/tree-sitter";
import { Method } from "../parser/utils";
import { AptedNode, GumtreeNode } from "./utils";
import { spawn } from "child_process";
import path from 'path';
import Parser, { SyntaxNode } from "tree-sitter";

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

export class CodeDiff {
    type: string;
    content: string;
    constructor(type: string, content: string) {
        this.type = type;
        this.content = content;
    }
}

class EditHook {
    type: string;
    content: string;
    constructor(type: string, content: string) {
        this.type = type;
        this.content = content;
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

function insertOrCreate(map: Map<number, EditHook[]>, key: number, hook: EditHook) {
    if(!map.get(key)) {
        map.set(key, []);
    }
    map.get(key)!.push(hook);
}

export async function getHighLight(code1: string, file1: string, code2: string, file2: string): Promise<CodeDiff[]> {
    let n1 = parseCodeIntoSyntaxNode(file1, code1);
    let n2 = parseCodeIntoSyntaxNode(file2, code2);
    let id2node1 = getId2NodeMapping4SyntaxNode(n1);
    let id2node2 = getId2NodeMapping4SyntaxNode(n2);
    try {
        let editString = await callEditScriptJavaCLI(convertTreeSitterNode2GumtreeNode(n1), convertTreeSitterNode2GumtreeNode(n2));
        let edits = JSON.parse(editString) as CodeEditScript[];
        let hookMapping = new Map<number, EditHook[]>();
        edits.forEach(edit => {
            if(edit.type === 'insert') {
                let hook = new EditHook('insert', id2node2.get(edit.src)!.text);
                insertOrCreate(hookMapping, id2node1.get(edit.dst)!.child(edit.pos)!.id, hook);
            } else if(edit.type === 'delete') {
                let hook = new EditHook('delete', '');
                insertOrCreate(hookMapping, edit.src, hook);
            } else if(edit.type === 'move') {
                let hook1 = new EditHook('delete', '');
                insertOrCreate(hookMapping, edit.src, hook1);
                let hook2 = new EditHook('insert', id2node1.get(edit.src)!.text);
                insertOrCreate(hookMapping, id2node1.get(edit.dst)!.child(edit.pos)!.id, hook2);
            } else if(edit.type === 'update') {
                let hook1 = new EditHook('delete', '');
                insertOrCreate(hookMapping, edit.src, hook1);
                let hook2 = new EditHook('insert', edit.val);
                insertOrCreate(hookMapping, edit.src, hook2);
            } else {
                throw new Error('unknown edit type: ' + edit.type);
            }
        });
        let diffs = traverseSyntaxNode4CodeDiff(n1, hookMapping);
        console.log(diffs);
        return diffs;
    } catch(err) {
        console.log(err);
        return [];
    }
}

function traverseSyntaxNode4CodeDiff(current: SyntaxNode, hooks: Map<number, EditHook[]>): CodeDiff[] {
    let shouldDisplay = true;
    let ret = [];
    hooks.get(current.id)?.forEach(hook => {
        if(hook.type === 'delete') {
            shouldDisplay = false;
            ret.push(new CodeDiff('delete', current.text));
        } else if(hook.type === 'insert') {
            ret.push('insert', hook.content);
        }
    });
    if(shouldDisplay) {
        if(current.childCount === 0) {
            ret.push(new CodeDiff('plain', current.text));
        } else {
            current.children.forEach(child => {
                let childDiff = traverseSyntaxNode4CodeDiff(child, hooks);
                ret.push(...childDiff);
            });
        }
    }
    return ret;
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