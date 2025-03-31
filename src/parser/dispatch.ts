import Parser from 'tree-sitter';
import { SupportedLanguage, Method } from './utils';
import * as java from './java';
import * as python from './python';

export function getAllMethodsInFile(file: string, language: SupportedLanguage, root: Parser.SyntaxNode): Method[] {
    switch(language) {
        case SupportedLanguage.Java:
            return java.getAllMethods(file, root, new java.JavaClass());
        case SupportedLanguage.Python:
            return python.getAllMethods(file, root);
        default:
            throw new Error('Unknown language');
    }
}