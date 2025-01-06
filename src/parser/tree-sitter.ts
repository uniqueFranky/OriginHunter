import Parser, { SyntaxNode } from 'tree-sitter';
import Java from 'tree-sitter-java';
import * as dispatch from './dispatch';
import * as utils from './utils';

export function testParser() {
    const parser = new Parser();
    parser.setLanguage(Java);

    const sourceCode = `
    public class A {
        public static void main(String []args) {
            return;
        }
    }
    `;
    const tree = parser.parse(sourceCode);

    console.log(tree.rootNode.toString());
}

function getTSLanguageForFile(fileName: string) {
    const parts = fileName.split('.');
    const ext = parts[parts.length - 1];
    switch(ext.toLowerCase()) {
        case 'java':
            return Java;
        default:
            throw new Error('Unsupported Language: ' + ext);
    }
}

export function parseCodeIntoMethods(fileName: string, code: string): utils.Method[] {
    const root = parseCodeIntoSyntaxNode(fileName, code);
    const language = utils.getSupportedLanguageForFile(fileName);
    const methods = dispatch.getAllMethodsInFile(fileName, language, root);
    return methods;
}

export function parseCodeIntoSyntaxNode(fileName: string, code: string): SyntaxNode {
    const parser = new Parser();
    parser.setLanguage(getTSLanguageForFile(fileName));
    const tree = parser.parse(code);
    return tree.rootNode;
}

export function doSupportsFile(fileName: string): boolean {
    try {
        utils.getSupportedLanguageForFile(fileName);
    } catch(error) {
        return false;
    }
    return true;
}