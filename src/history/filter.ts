import { SyntaxNode } from "tree-sitter";
import { MethodLevelHistory } from "./codeshovel";
import * as vscode from 'vscode';
import { getMappingsBetweenMethods, getMappingsBetweenSyntaxNodes } from "./mapping";

class FilterTreeNode {
    id: number;
    tsNode: SyntaxNode;
    depth: number;
    depthFromBot: number;
    children: FilterTreeNode[];
    parents: Map<number, number>;
    dfin: number;
    dfout: number;

    constructor(node: SyntaxNode) {
        this.id = node.id;
        this.tsNode = node;
        this.depth = -1;
        this.depthFromBot = -1;
        this.children = [];
        this.parents = new Map<number, number>();
        this.dfin = 0;
        this.dfout = 0;
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

    public calcDepth(nowDep: number): number {
        this.depth = nowDep;
        if(this.children.length === 0) {
            this.depthFromBot = 1;
        }
        this.children.forEach(child => {
            const childDepthFromBot = child.calcDepth(nowDep + 1);
            if(this.depthFromBot < childDepthFromBot + 1) {
                this.depthFromBot = childDepthFromBot + 1;
            }
        });
        return this.depthFromBot;
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

    public calcDfn(stamp: number): number {
        this.dfin = stamp;
        this.children.forEach(child => {
            stamp = child.calcDfn(stamp + 1);
        });
        this.dfout = stamp + 1;
        return this.dfout;
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

    public getLCA4TSNodes(nodes: SyntaxNode[]): FilterTreeNode {
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

    public getLCA4Nodes(nodes: FilterTreeNode[]): FilterTreeNode {
        if(nodes.length === 1) {
            return nodes[0];
        } else {
            let ret = this.getLCA(nodes[0].tsNode, nodes[1].tsNode);
            for(let i = 2; i < nodes.length; i++) {
                ret = this.getLCA(ret.tsNode, nodes[i].tsNode);
            }
            return ret;
        }
    }

    public calcDfn() {
        this.root.calcDfn(1);
    }

    public calcGuardiansWhichGuards(nodes: FilterTreeNode[]): FilterTreeNode[] {
        if(nodes.length === 1) {
            return nodes;
        } else if(nodes.length === 0) {
            return [];
        }
        let lca = this.getLCA4Nodes(nodes);
        this.calcDfn();
        let guardians: FilterTreeNode[] = [];
        let minDfin = 100000000;
        let maxDfin = 0;
        lca.children.forEach(child => {
            for(let i = 0; i < nodes.length; i++) {
                let node = this.id2NodeMapping.get(nodes[i].id)!;
                if(node.dfin >= child.dfin && node.dfout <= child.dfout) {
                    // child guards one of nodes
                    minDfin = minDfin < child.dfin ? minDfin : child.dfin;
                    maxDfin = maxDfin > child.dfin ? maxDfin : child.dfin;
                    break;
                }
            }
        });
        // all children of lca with dfin between (min, max) are considered guardians.
        // because some insertion can be present
        lca.children.forEach(child => {
            if(child.dfin >= minDfin && child.dfin <= maxDfin) {
                guardians.push(child);
            }
        });
        return guardians;
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

export async function filterMethodsByRange(histories: MethodLevelHistory[], range: vscode.Range): Promise<MethodLevelHistory[]> {
    let syntaxes = histories.map(h => h.method.syntaxNode);
    let filterTrees = syntaxes.map(node => FilterTree.fromTSNode(node));
    filterTrees.forEach(tree => {
        let mapping = getId2NodeMapping4FilterTreeNode(tree.root);
        tree.setId2NodeMapping(mapping);
    });
    // get guardians for 0-th tree
    let nodes = getSyntaxRange(syntaxes[0], range);
    let guardians = filterTrees[0].calcGuardiansWhichGuards(nodes.map(node => filterTrees[0].id2NodeMapping.get(node.id)!));
    // iterate all versions
    let result = [histories[0]];
    for(let i = 1; i < histories.length && guardians.length > 0; i++) {
        console.log(guardians);
        let mappings = await getMappingsBetweenMethods(histories[i - 1].method, histories[i].method);
        let map = new Map<number, number>(); // map of ids from i-1 to i
        mappings.forEach(unit => {
            map.set(unit[0], unit[1]);
        });
        let newGuardians: FilterTreeNode[] = [];
        let shouldAddToHistory = false;
        guardians.forEach(guardian => {
            let cor = map.get(guardian.id);
            if(!cor) {
                shouldAddToHistory = true;
                return;
            }
            let node1 = filterTrees[i - 1].id2NodeMapping.get(guardian.id)!;
            let node2 = filterTrees[i].id2NodeMapping.get(cor)!;
            newGuardians.push(node2);
            if(!shouldAddToHistory && node1.tsNode.text !== node2.tsNode.text) {
                shouldAddToHistory = true;
            }
        });
        guardians = filterTrees[i].calcGuardiansWhichGuards(newGuardians);
        if(shouldAddToHistory || guardians.length !== newGuardians.length) {
            result.push(histories[i]);
        } else {
            result[result.length - 1] = histories[i];
        }
    }
    return result;
}

function getSingleNodeInRange(root: SyntaxNode, range: vscode.Range) {
    console.log(root.type);
    if(root.startPosition.row + 1 === range.start.line && root.endPosition.row + 1 === range.end.line) {
        return root;
    }
    for(let child of root.children) {
        if(child.startPosition.row + 1 <= range.start.line && child.endPosition.row + 1 >= range.end.line) {
            return getSingleNodeInRange(child, range);
        }
    }
    throw new Error('no matching child');
}

function isIsomorphic(node1: SyntaxNode, node2: SyntaxNode): boolean {
    if(node1.type !== node2.type) {
        return false;
    }
    if(node1.childCount === 0) {
        return node1.text === node2.text;
    }
    let nonCommentChildren1 = [];
    let nonCommentChildren2 = [];
    for(let child of node1.children) {
        if(child.type.toLowerCase().includes('comment')) {
            continue;
        }
        nonCommentChildren1.push(child);
    }
    for(let child of node2.children) {
        if(child.type.toLowerCase().includes('comment')) {
            continue;
        }
        nonCommentChildren2.push(child);
    }
    if(nonCommentChildren1.length !== nonCommentChildren2.length) {
        return false;
    }
    for(let i = 0; i < nonCommentChildren1.length; i++) {
        if(!isIsomorphic(nonCommentChildren1[i], nonCommentChildren2[i])) {
            return false;
        }
    }
    return true;
}

export async function filterMethodsByNode(histories: MethodLevelHistory[], range: vscode.Range): Promise<MethodLevelHistory[]> {
    let syntaxes = histories.map(h => h.method.syntaxNode);
    let filterTrees = syntaxes.map(node => FilterTree.fromTSNode(node));
    filterTrees.forEach(tree => {
        let mapping = getId2NodeMapping4FilterTreeNode(tree.root);
        tree.setId2NodeMapping(mapping);
    });
    // get guardians for 0-th tree

    let nodes = [getSingleNodeInRange(syntaxes[0], range)];
    console.log(nodes[0].text);
    let guardians = filterTrees[0].calcGuardiansWhichGuards(nodes.map(node => filterTrees[0].id2NodeMapping.get(node.id)!));
    console.log(guardians[0].tsNode.text);
    // iterate all versions
    let result = [histories[0]];
    for(let i = 1; i < histories.length && guardians.length > 0; i++) {
        let mappings = await getMappingsBetweenMethods(histories[i - 1].method, histories[i].method);
        let map = new Map<number, number>(); // map of ids from i-1 to i
        mappings.forEach(unit => {
            map.set(unit[0], unit[1]);
        });
        let newGuardians: FilterTreeNode[] = [];
        let shouldAddToHistory = false;
        if(guardians.length === 1) {
            let guardian = guardians[0];
            let cor = map.get(guardian.id);
            if(!cor) {
                shouldAddToHistory = true;
                guardians = guardian.children;
            } else {
                let node1 = filterTrees[i - 1].id2NodeMapping.get(guardian.id)!;
                let node2 = filterTrees[i].id2NodeMapping.get(cor)!;
                newGuardians.push(node2);
                if(!shouldAddToHistory && !isIsomorphic(node1.tsNode, node2.tsNode)) {
                    shouldAddToHistory = true;
                }
            }
        } 
        if(guardians.length > 1) {
            guardians.forEach(guardian => {
                let cor = map.get(guardian.id);
                if(!cor) {
                    shouldAddToHistory = true;
                    return;
                }
                let node1 = filterTrees[i - 1].id2NodeMapping.get(guardian.id)!;
                let node2 = filterTrees[i].id2NodeMapping.get(cor)!;
                newGuardians.push(node2);
                if(!shouldAddToHistory && !isIsomorphic(node1.tsNode, node2.tsNode)) {
                    shouldAddToHistory = true;
                }
            });
        }

        guardians = filterTrees[i].calcGuardiansWhichGuards(newGuardians);
        if(shouldAddToHistory || guardians.length !== newGuardians.length) {
            result.push(histories[i]);
        } else {
            result[result.length - 1] = histories[i];
        }
    }
    return result;
}



function rangeIntersects(start1: number, end1: number, start2: number, end2: number): boolean {
    return start1 <= end2 && end1 >= start2;
}

function getSyntaxRangeByLineNumber(root: SyntaxNode, start: number, end: number): SyntaxNode[] {
    const currentStart = root.startPosition.row + 1;
    const currentEnd = root.endPosition.row + 1;
    if(start <= currentStart && end >= currentEnd) {
        return [root];
    }
    if(root.childCount === 0 && rangeIntersects(start, end, currentStart, currentEnd)) {
        return [root];
    }

    const ret: SyntaxNode[] = [];
    for(let i = 0; i < root.childCount; i++) {
        const childStart = root.child(i)!.startPosition.row + 1;
        const childEnd = root.child(i)!.endPosition.row + 1;
        if(rangeIntersects(start, end, childStart, childEnd)) {
            getSyntaxRangeByLineNumber(root.child(i)!, start, end).forEach(node => ret.push(node));
        }
    }
    return ret;
}

function randomSample(root: FilterTreeNode, pDeep: number, first: boolean): FilterTreeNode[] {
    if(!root.tsNode.isNamed) {
        return [];
    }
    const ret: FilterTreeNode[] = [];
    if(first || Math.random() < pDeep && root.depthFromBot >= 3) {
        root.children.forEach(child => {
            ret.push(...randomSample(child, pDeep, false));
        });
    } else {
        ret.push(root);
    }
    return ret;
}

export async function getRangeInPreviousVersion(oldSyntaxNode: SyntaxNode, newSyntaxNode: SyntaxNode, start: number, end: number): Promise<[number, number]> {
    const oldFilterTree = FilterTree.fromTSNode(oldSyntaxNode);
    const newFilterTree = FilterTree.fromTSNode(newSyntaxNode);
    oldFilterTree.setId2NodeMapping(getId2NodeMapping4FilterTreeNode(oldFilterTree.root));
    newFilterTree.setId2NodeMapping(getId2NodeMapping4FilterTreeNode(newFilterTree.root));
    // get guardians for 0-th tree
    const nodes = getSyntaxRangeByLineNumber(newSyntaxNode, start, end);

    let guardians = newFilterTree.calcGuardiansWhichGuards(nodes.map(node => newFilterTree.id2NodeMapping.get(node.id)!));

    const mappings = await getMappingsBetweenSyntaxNodes(newSyntaxNode, oldSyntaxNode);
    const map = new Map<number, number>(); // map of ids from i-1 to i
    mappings.forEach(unit => {
        map.set(unit[0], unit[1]);
    });
    const newGuardians: FilterTreeNode[] = [];
    guardians.forEach(guardian => {
        const cor = map.get(guardian.id);
        if(!cor) {
            const nodes = randomSample(guardian, 0.5, true);
            nodes.forEach(node => {
                const corr = map.get(node.id);
                if(corr) {
                    newGuardians.push(oldFilterTree.id2NodeMapping.get(corr)!);
                }
            });
        } else {
            const node = oldFilterTree.id2NodeMapping.get(cor)!;
            newGuardians.push(node);
        }
    });
    guardians = oldFilterTree.calcGuardiansWhichGuards(newGuardians);
    let s = 100000000;
    let e = 0;
    guardians.forEach(node => {
        if(node.tsNode.startPosition.row + 1 < s) {
            s = node.tsNode.startPosition.row + 1;
        }
        if(node.tsNode.endPosition.row + 1 > e) {
            e = node.tsNode.endPosition.row + 1;
        }
    });
    return [s, e];
}
