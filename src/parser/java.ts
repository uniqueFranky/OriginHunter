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

export class JavaGenericTypeParameter extends Parameter {
    bound: string;
    constructor(type: string, name: string, bound: string) {
        super(type, name);
        this.bound = bound;
    }
    public equals(rhs: Parameter): boolean {
        return super.equals(rhs) && rhs instanceof JavaGenericTypeParameter && this.bound === rhs.bound;
    }
}

export function getSingleMethod(root: Parser.SyntaxNode): JavaMethod {
    let cursor = root.walk();
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


    // handles children of "method_declaration"
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
        } else if(cursor.currentNode.type.endsWith('generic_type')) {
            cursor.gotoFirstChild();
            type = cursor.currentNode.text;
            cursor.gotoNextSibling();
            type += cursor.currentNode.text;
            cursor.gotoParent();
        } else if(cursor.currentNode.type.endsWith('identifier')) {
            name = cursor.currentNode.text;
        } else if(cursor.currentNode.type.endsWith('formal_parameters')) {
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
        } else if(cursor.currentNode.type.endsWith('type_parameters')) {
            let handleTypeParameter = () => {
                cursor.gotoFirstChild();
                // cursor @type_identifier
                let paramName = cursor.currentNode.text;
                cursor.gotoNextSibling();
                // cursor @type_bound
                cursor.gotoFirstChild();
                let bound = cursor.currentNode.text;
                cursor.gotoNextSibling();
                let paramType = cursor.currentNode.text;
                cursor.gotoParent();
                cursor.gotoParent();
                // cursor @type_parameter
                params.push(new JavaGenericTypeParameter(paramType, paramName, bound));
            };
            cursor.gotoFirstChild();
            while(cursor.gotoNextSibling()) {
                if(!cursor.currentNode.isNamed) { // skip '<'
                    continue;
                }
                handleTypeParameter();
            }
            cursor.gotoParent();
        } else if(cursor.currentNode.type.endsWith('block')) {
            body = cursor.currentNode.text;
        } else {
            console.log(cursor.currentNode.type, cursor.currentNode.text);
            throw new Error('Unexpected Java Syntax Node');
        }
    };
    
    // cursor @first child of method_declaration
    handler();
    while(cursor.gotoNextSibling()) {
        handler();
    }
    let sig = new JavaMethodSignature(modifiers, type, name, params);
    return new JavaMethod(sig, body);
}

export function getAllMethods(current: Parser.SyntaxNode): JavaMethod[] {
    let ret: JavaMethod[] = [];
    if(current.type.endsWith('method_declaration')) {
        ret.push(getSingleMethod(current));
    } else {
        if(current.firstNamedChild) {
            ret.push(...getAllMethods(current.firstNamedChild));
        }
    }
    if(current.nextNamedSibling) {
        ret.push(...getAllMethods(current.nextNamedSibling));
    }
    return ret;
}
