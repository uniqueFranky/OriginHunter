import * as git from '../git/gitAPI';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { parseCodeIntoMethods, parseCodeIntoSyntaxNode } from '../parser/tree-sitter';
import { getRangeInPreviousVersion } from '../history/filter';

class TestResult {
    oldCode: string;
    oldCommit: string;
    newCode: string;
    newCommit: string;
    newStart: number;
    newEnd: number;
    gtStart: number;
    gtEnd: number;
    ohStart: number;
    ohEnd: number;
    constructor(oldCode: string, oldCommit: string, newCode: string, newCommit: string, newStart: number, newEnd: number, gtStart: number, gtEnd: number, ohStart: number, ohEnd: number) {
        this.oldCode = oldCode;
        this.oldCommit = oldCommit;
        this.newCode = newCode;
        this.newCommit = newCommit;
        this.newStart = newStart;
        this.newEnd = newEnd;
        this.gtStart = gtStart;
        this.gtEnd = gtEnd;
        this.ohStart = ohStart;
        this.ohEnd = ohEnd;
    }

    public isCorrect(): boolean {
        return this.ohStart === this.gtStart && this.ohEnd === this.gtEnd;
    }

    public isSound(): boolean {
        return this.ohStart <= this.gtStart && this.ohEnd >= this.gtEnd;
    }
}

function getLinesFromTo(str: string, i: number, j: number): string {
    const lines = str.split(/\r?\n/); // 保留空行
    const selectedLines = lines.slice(i - 1, j); // i 和 j 从 1 开始，数组索引从 0 开始
    return selectedLines.join('\n');
}

async function singleTest(oracleName: string): Promise<[TestResult[], boolean]> {
    const ret: TestResult[] = [];
    const oracleContent = await fs.readFile(oracleName, 'utf-8');
    const oracle = JSON.parse(oracleContent);
    const versions = oracle['statementVersions'];
    const verNum = versions.length;
    for(let i = 0; i + 1 < verNum; i++) {
        const newCode: string = versions[i]['methodCode'];
        const oldCode: string = versions[i + 1]['methodCode'];
        const newStatements = getLinesFromTo(newCode, versions[i]['startLine'], versions[i]['endLine']);
        const oldStatements = getLinesFromTo(oldCode, versions[i + 1]['startLine'], versions[i + 1]['endLine']);
        if(newStatements === oldStatements) {
            continue;
        }
        const newSyntaxNode = parseCodeIntoSyntaxNode('1.py', newCode);
        const oldSyntaxNode = parseCodeIntoSyntaxNode('1.py', oldCode);

        const [resStart, resEnd] = await getRangeInPreviousVersion(oldSyntaxNode, newSyntaxNode, versions[i]['startLine'], versions[i]['endLine']);
        ret.push(new TestResult(oldCode, versions[i + 1]['commit'], newCode, versions[i]['commit'], versions[i]['startLine'], versions[i]['endLIne'], versions[i + 1]['startLine'], versions[i + 1]['endLine'], resStart, resEnd));
    }
    return [ret, ret.filter(r => r.isCorrect()).length === ret.length];
}

export async function doStatementTest() {
    const oraclePath = path.join(__dirname, 'block_oracles', 'python');
    const oracleFileNames = await fs.readdir(oraclePath);
    const results: TestResult[] = [];
    let allCorrect = 0;
    const promises = oracleFileNames.map(name =>
        singleTest(path.join(oraclePath, name)).then(res => {
            results.push(...res[0]);
            if(res[1]) {
                allCorrect += 1;
            }
        })
    );
    await Promise.all(promises);
    const totNum = results.length;
    const correctNum = results.filter(result => result.isCorrect()).length;
    const soundNum = results.filter(result => result.isSound()).length;
    console.log('accuracy: ' + correctNum / totNum + ' (' + correctNum + '/' + totNum + ')');
    console.log('soundiness: ' + soundNum / totNum + ' (' + soundNum + '/' + totNum + ')');
    console.log(allCorrect / oracleFileNames.length + ' (' + allCorrect + '/' + oracleFileNames.length + ')');
}

