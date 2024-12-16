import Parser from 'tree-sitter';
import { SupportedLanguage, Method } from './utils';
import * as java from './java';

export function getSingleMethod(language: SupportedLanguage, root: Parser.SyntaxNode): Method {
    switch(language) {
        case SupportedLanguage.Java:
            return java.getSingleMethod(root);
        default:
            throw new Error('Unknown language');
    }
}

export function getAllMethods(language: SupportedLanguage, root: Parser.SyntaxNode): Method[] {
    switch(language) {
        case SupportedLanguage.Java:
            return java.getAllMethods(root);
        default:
            throw new Error('Unknown language');
    }
}