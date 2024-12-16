import Parser from 'tree-sitter';
import Java from 'tree-sitter-java';

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

function getLanguageForFile(fileName: string) {
    const parts = fileName.split('.');
    const ext = parts[parts.length - 1];
    switch(ext.toLowerCase()) {
        case 'java':
            return Java;
        default:
            throw new Error('Unsupported Language: ' + ext);
    }
}

export function parseSelectedCode(fileName: string, code: string) {
    const parser = new Parser();
    parser.setLanguage(getLanguageForFile(fileName));

    const tree = parser.parse(code);
    console.log(tree.rootNode.toString());
}