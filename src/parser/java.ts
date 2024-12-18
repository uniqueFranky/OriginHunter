import Parser from 'tree-sitter';
import { Parameter, MethodSignature, SupportedLanguage, Method, MethodContainer } from './utils';

export class JavaMethodSignature extends MethodSignature {
    modifiers: string[];
    throws: string;
    constructor(modifiers: string[], type: string, name: string, params: Parameter[], throws: string) {
        super(SupportedLanguage.Java, type, name, params);
        this.modifiers = modifiers;
        this.throws = throws;
    }

    public equals(rhs: MethodSignature): boolean {
        if(!super.equals(rhs) || !(rhs instanceof JavaMethodSignature)) {
            return false;
        }
        if(rhs.modifiers.length !== this.modifiers.length || rhs.throws !== this.throws) {
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
        return `${this.modifiers.join(' ')}` + ' ' + s + ' ' + this.throws;
    }
}

export class JavaClass {
    modifiers: string[];
    name: string;
    params: JavaGenericTypeParameter[];
    constructor(modifiers: string[] = [], name: string = 'Unknown', params: JavaGenericTypeParameter[] = []) {
        this.modifiers = modifiers;
        this.name = name;
        this.params = params;
    }

    public equals(rhs: JavaClass): boolean {
        if(this.name !== rhs.name || this.modifiers.length !== rhs.modifiers.length || this.params.length !== rhs.params.length) {
            return false;
        }
        for(let i = 0; i < this.modifiers.length; i++) {
            if(this.modifiers[i] !== rhs.modifiers[i]) {
                return false;
            }
        }
        for(let i = 0; i < this.params.length; i++) {
            if(!this.params[i].equals(rhs.params[i])) {
                return false;
            }
        }
        return true;
    }
}

export class JavaMethodContainer extends MethodContainer {
    klass: JavaClass;
    constructor(file: string, klass: JavaClass) {
        super(file);
        this.klass = klass;
    }

    public equals(rhs: MethodContainer) {
        // return super.equals(rhs) && rhs instanceof JavaMethodContainer && this.klass.equals(rhs.klass);
        return super.equals(rhs);
    }

    public copy(): JavaMethodContainer {
        return new JavaMethodContainer(this.filePath, this.klass);
    }
}

export class JavaMethod extends Method {
    constructor(container: JavaMethodContainer, sig: JavaMethodSignature, body: string) {
        super(container, sig, body);
    }

    public copy(): JavaMethod {
        return new JavaMethod(this.container.copy() as JavaMethodContainer, this.signature as JavaMethodSignature, this.body);
    }
}

export class JavaGenericTypeParameter extends Parameter {
    bound: string;

    // name bound   type
    // T    extends SomeType
    constructor(type: string, name: string, bound: string) {
        super(type, name);
        this.bound = bound;
    }
    public equals(rhs: Parameter): boolean {
        return super.equals(rhs) && rhs instanceof JavaGenericTypeParameter && this.bound === rhs.bound;
    }
}

function parseTypeParameter(typeParameter: Parser.SyntaxNode): JavaGenericTypeParameter {
    let cursor = typeParameter.walk();
    cursor.gotoFirstChild();
    // cursor @type_identifier
    let paramName = cursor.currentNode.text;
    cursor.gotoNextSibling();
    // cursor @type_bound
    cursor.gotoFirstChild();
    let bound = cursor.currentNode.text;
    cursor.gotoNextSibling();
    let paramType = cursor.currentNode.text;
    // cursor @type_parameter
    return new JavaGenericTypeParameter(paramType, paramName, bound);
}

function getSingleMethod(root: Parser.SyntaxNode, container: JavaMethodContainer): JavaMethod {
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
    let throws: string = '';
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
        } else if(cursor.currentNode.type.endsWith('generic_type')) {
            cursor.gotoFirstChild();
            type = cursor.currentNode.text;
            cursor.gotoNextSibling();
            type += cursor.currentNode.text;
            cursor.gotoParent();
        } else if(cursor.currentNode.type.endsWith('type_identifier') || cursor.currentNode.type.endsWith('_type')) { // 'void' 'int' are 'void_type' 'int_type' respectively
            type = cursor.currentNode.text;
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
            cursor.gotoFirstChild();
            while(cursor.gotoNextSibling()) {
                if(!cursor.currentNode.isNamed) { // skip '<'
                    continue;
                }
                params.push(parseTypeParameter(cursor.currentNode));
            }
            cursor.gotoParent();
        } else if(cursor.currentNode.type.endsWith('block')) {
            body = cursor.currentNode.text;
        } else if(cursor.currentNode.type.endsWith('throws')) {
            throws = cursor.currentNode.text;
        } else if(cursor.currentNode.type === ';') {
            ;
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
    let sig = new JavaMethodSignature(modifiers, type, name, params, throws);
    return new JavaMethod(container, sig, body);
}

export function getAllMethods(file: string, current: Parser.SyntaxNode, klass: JavaClass): JavaMethod[] {
    let ret: JavaMethod[] = [];
    if(current.type.endsWith('method_declaration')) {
        ret.push(getSingleMethod(current, new JavaMethodContainer(file, klass)));
    } else {
        if(current.type.endsWith('class_declaration')) {
            let modifiers: string[] = [];
            let name = '';
            let params: JavaGenericTypeParameter[] = [];
            let cursor = current.walk();
            cursor.gotoFirstChild();
            let klassHandler = () => {
                if(cursor.currentNode.type.endsWith('modifiers')) {
                    cursor.gotoFirstChild();
                    modifiers.push(cursor.currentNode.text);
                    while(cursor.gotoNextSibling()) {
                        modifiers.push(cursor.currentNode.text);
                    }
                    cursor.gotoParent();
                } else if(cursor.currentNode.type.endsWith('identifier')) {
                    name = cursor.currentNode.text;
                } else if(cursor.currentNode.type.endsWith('type_parameters')) {
                    cursor.gotoFirstChild();
                    while(cursor.gotoNextSibling()) {
                        if(!cursor.currentNode.isNamed) { // skip '<'
                            continue;
                        }
                        params.push(parseTypeParameter(cursor.currentNode));
                    }
                    cursor.gotoParent();
                } else {
                    ;
                }
            };
            klassHandler();
            while(cursor.gotoNextSibling()) {
                klassHandler();
            }
            klass = new JavaClass(modifiers, name, params);
        }
        if(current.firstNamedChild) {
            ret.push(...getAllMethods(file, current.firstNamedChild, klass));
        }
    }
    if(current.nextNamedSibling) {
        ret.push(...getAllMethods(file, current.nextNamedSibling, klass));
    }
    return ret;
}
