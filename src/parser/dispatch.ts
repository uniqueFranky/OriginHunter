import Parser from 'tree-sitter';
import { SupportedLanguage, Method } from './utils';
import * as java from './java';

export function getAllMethodsInFile(file: string, language: SupportedLanguage, root: Parser.SyntaxNode): Method[] {
    switch(language) {
        case SupportedLanguage.Java:
            return java.getAllMethods(file, root, new java.JavaClass());
        default:
            throw new Error('Unknown language');
    }
}