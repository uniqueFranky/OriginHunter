import Parser from 'tree-sitter';
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

export function parseCode(fileName: string, code: string): utils.Method[] {
    const parser = new Parser();
    parser.setLanguage(getTSLanguageForFile(fileName));

    const tree = parser.parse(code);
    const language = utils.getSupportedLanguageForFile(fileName);
    // const method = dispatch.getSingleMethod(language, tree.rootNode);
    const methods = dispatch.getAllMethodsInFile(fileName, language, tree.rootNode);
    return methods;
    // in case of injection, when displaying the json on webview, we have to replace "<>"
}

export function doSupportsFile(fileName: string): boolean {
    try {
        utils.getSupportedLanguageForFile(fileName);
    } catch(error) {
        return false;
    }
    return true;
}