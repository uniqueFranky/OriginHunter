import { SyntaxNode } from "tree-sitter";
import { MethodLevelHistory } from "./codeshovel";
import * as vscode from 'vscode';

class FilterTreeNode {
    id: number;
    tsNode: SyntaxNode;
    depth: number;
    children: FilterTreeNode[];
    parents: Map<number, number>;

    constructor(node: SyntaxNode) {
        this.id = node.id;
        this.tsNode = node;
        this.depth = -1;
        this.children = [];
        this.parents = new Map<number, number>();
    }

    public addChild(child: FilterTreeNode) {
        this.children.push(child);
    }

    public static fromTSNode(tsNode: SyntaxNode): FilterTreeNode {
        let ret = new FilterTreeNode(tsNode);
        tsNode.children.forEach(tsChild => {
            let child = this.fromTSNode(tsChild);
            child.parents.set(0, ret.id);
            ret.addChild(child);
        });
        return ret;
    }

    public calcDepth(nowDep: number) {
        this.depth = nowDep;
        this.children.forEach(child => {
            child.calcDepth(nowDep + 1);
        });
    }

    public calcParent4Level(level: number, id2NodeMapping: Map<number, FilterTreeNode>) {
        for(let i = 1; i <= level; i++) {
            this.parents.set(i, id2NodeMapping.get(this.parents.get(i - 1)!)!.parents.get(i - 1)!);
        }
        this.children.forEach(child => {
            child.calcParent4Level(level, id2NodeMapping);
        });
    }

    public getAncestor4Level(level: number, id2NodeMapping: Map<number, FilterTreeNode>): FilterTreeNode {
        return id2NodeMapping.get(this.parents.get(level)!)!;
    }
}

class FilterTree {
    root: FilterTreeNode;
    id2NodeMapping: Map<number, FilterTreeNode>;
    alreadyCalc: boolean;
    constructor(root: FilterTreeNode, mapping: Map<number, FilterTreeNode> = new Map<number, FilterTreeNode>()) {
        this.root = root;
        this.root.parents.set(0, this.root.id);
        this.id2NodeMapping = mapping;
        this.alreadyCalc = false;
    }

    public setId2NodeMapping(mapping: Map<number, FilterTreeNode>) {
        this.id2NodeMapping = mapping;
    }

    public static fromTSNode(tsNode: SyntaxNode): FilterTree {
        return new FilterTree(FilterTreeNode.fromTSNode(tsNode));
    }

    private preCalcIfNotDone() {
        if(this.alreadyCalc) {
            return;
        }
        this.root.calcDepth(0);
        this.root.calcParent4Level(20, this.id2NodeMapping);
        this.alreadyCalc = true;
    }

    private getLCA(node1: SyntaxNode, node2: SyntaxNode): FilterTreeNode {
        this.preCalcIfNotDone();
        let n1 = this.id2NodeMapping.get(node1.id)!;
        let n2 = this.id2NodeMapping.get(node2.id)!;
        
        if(n1.depth < n2.depth) {
            let tmp = n1;
            n1 = n2;
            n2 = tmp;
        }

        // now n1.depth >= n2.depth
        for(let i = 20; i >= 0; i--) {
            let fa = n1.getAncestor4Level(i, this.id2NodeMapping);
            if(fa.depth >= n2.depth) {
                n1 = fa;
            }
        }
        
        // now n1.depth === n2.depth
        if(n1.id === n2.id) {
            return n1;
        }

        // jump together
        for(let i = 20; i >= 0; i--) {
            let fa1 = n1.getAncestor4Level(i, this.id2NodeMapping);
            let fa2 = n2.getAncestor4Level(i, this.id2NodeMapping);
            if(fa1.id !== fa2.id) {
                n1 = fa1;
                n2 = fa2;
            }
        }
        return n1.getAncestor4Level(0, this.id2NodeMapping); 
    }

    public getLCA4Nodes(nodes: SyntaxNode[]): FilterTreeNode {
        if(nodes.length === 1) {
            return this.id2NodeMapping.get(nodes[0].id)!;
        } else {
            let ret = this.getLCA(nodes[0], nodes[1]);
            for(let i = 2; i < nodes.length; i++) {
                ret = this.getLCA(ret.tsNode, nodes[i]);
            }
            return ret;
        }
    }
}

function newRangeFromSyntaxNode(node: SyntaxNode) {
    return new vscode.Range(new vscode.Position(node.startPosition.row, node.startPosition.column), new vscode.Position(node.endPosition.row, node.endPosition.column));
}

function getSyntaxRange(root: SyntaxNode, target: vscode.Range): SyntaxNode[] {
    let currentRange = newRangeFromSyntaxNode(root);
    if(target.contains(currentRange)) {
        return [root];
    }
    if(root.childCount === 0 && currentRange.intersection(target)) {
        return [root];
    }
    let ret: SyntaxNode[] = [];
    for(let i = 0; i < root.childCount; i++) {
        let childRange = newRangeFromSyntaxNode(root.child(i)!);
        if(childRange.intersection(target)) {
            getSyntaxRange(root.child(i)!, target).forEach(node => ret.push(node));
        }
    }
    return ret;
}

function getId2NodeMapping4FilterTreeNode(current: FilterTreeNode): Map<number, FilterTreeNode> {
    let ret = new Map<number, FilterTreeNode>();
    ret.set(current.id, current);
    current.children.forEach(child => {
        let childMap = getId2NodeMapping4FilterTreeNode(child);
        childMap.forEach((v, k) => ret.set(k, v));
    });
    return ret;
}


export function filterMethodsByRange(histories: MethodLevelHistory[], range: vscode.Range): MethodLevelHistory[] {
    let syntaxes = histories.map(h => h.method.syntaxNode);
    let filterTrees = syntaxes.map(node => FilterTree.fromTSNode(node));
    filterTrees.forEach(tree => {
        let mapping = getId2NodeMapping4FilterTreeNode(tree.root);
        tree.setId2NodeMapping(mapping);
    });

    let nodes = getSyntaxRange(syntaxes[0], range);
    let LCA = filterTrees[0].getLCA4Nodes(nodes);
    console.log(LCA.tsNode.text);
    return [];
}