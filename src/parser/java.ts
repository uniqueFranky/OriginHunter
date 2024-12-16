import Parser from 'tree-sitter';
import {Parameter, MethodSignature, SupportedLanguage, Method} from './utils';

export class JavaMethodSignature extends MethodSignature {
    modifiers: string[];
    constructor(modifiers: string[], type: string, name: string, params: Parameter[]) {
        super(SupportedLanguage.Java, type, name, params);
        this.modifiers = modifiers;
    }

    public equals(rhs: MethodSignature): boolean {
        if(!super.equals(rhs) || !(rhs instanceof JavaMethodSignature)) {
            return false;
        }
        if(rhs.modifiers.length !== this.modifiers.length) {
            return false;
        }
        for(let i = 0; i < this.modifiers.length; i++) {
            if(this.modifiers[i] !== rhs.modifiers[i]) {
                return false;
            }
        }
        return true;
    }

    public toString(): string {
        let s = super.toString();
        return `${this.modifiers.join(' ')}` + ' ' + s;
    }
}

export class JavaMethod extends Method {
    constructor(sig: JavaMethodSignature, body: string) {
        super(sig, body);
    }
}

export function getSingleMethod(root: Parser.SyntaxNode): JavaMethod {
    let cursor = root.walk();
    while(cursor.currentNode.type !== 'method_declaration') {
        console.log(cursor.currentNode.type);
        if(!cursor.gotoFirstChild()) {
            break;
        }
    }
    if(cursor.currentNode.type !== 'method_declaration') {
        throw new Error('Not a Java Method Declaration, but a ' + cursor.currentNode.type);
    }
    // cursor @method declaration
    cursor.gotoFirstChild();
    
    let modifiers: string[] = [];
    let type: string = '';
    let name: string = '';
    let body: string = '';
    let params: Parameter[] = [];

    
    let handler = () => {
        if(cursor.currentNode.type.endsWith('modifiers')) {
            cursor.gotoFirstChild();
            modifiers.push(cursor.currentNode.text);
            while(cursor.gotoNextSibling()) {
                modifiers.push(cursor.currentNode.text);
            }
            cursor.gotoParent();
        } else if(cursor.currentNode.type.endsWith('type_identifier')) {
            type = cursor.currentNode.text;
        } else if(cursor.currentNode.type.endsWith('identifier')) {
            name = cursor.currentNode.text;
        } else if(cursor.currentNode.type.endsWith('parameters')) {
            if(cursor.gotoFirstChild()) {
                while(cursor.gotoNextSibling()) {
                    if(!cursor.currentNode.isNamed) {
                        continue;
                    }
                    let text = cursor.currentNode.text;
                    let parts = text.split(' ');
                    params.push(new Parameter(parts.slice(0, -1).join(' '), parts[parts.length - 1]));
                }
                cursor.gotoParent();
            }
        } else if(cursor.currentNode.type.endsWith('block')) {
            body = cursor.currentNode.text;
        } else {
            console.log(cursor.currentNode.type, cursor.currentNode.text);
            throw new Error('Unexpected Java Syntax Node');
        }
    };
    
    handler();
    // cursor @method_declaration
    while(cursor.gotoNextSibling()) {
        handler();
    }
    let sig = new JavaMethodSignature(modifiers, type, name, params);
    return new JavaMethod(sig, body);
}