import Parser, { SyntaxNode } from 'tree-sitter';
import { Parameter, MethodSignature, SupportedLanguage, Method, MethodContainer } from './utils';

export class PythonClass {
    name: string;
    constructor(name: string) {
        this.name = name;
    }
}

export class PythonMethodParameter extends Parameter {
    defa: string;
    constructor(type: string, name: string, defa: string = '') {
        super(type, name);
        this.defa = defa;
    }

    public equals(rhs: Parameter) {
        if(!(rhs instanceof PythonMethodParameter)) {
            return false;
        }
        let r = rhs as PythonMethodParameter;
        return this.name === r.name && this.type === r.type && this.defa === rhs.defa;
    }
}

export class PythonMethodContainer extends MethodContainer {
    klass: PythonClass;
    constructor(filePath: string, klass: PythonClass = new PythonClass('None')) {
        super(filePath);
        this.klass = klass;
    }

    public copy(): PythonMethodContainer {
        return new PythonMethodContainer(this.filePath, this.klass);
    }
}

export class PythonMethodSignature extends MethodSignature {
    constructor(type: string, name: string, params: Parameter[]) {
        super(SupportedLanguage.Python, type, name, params);
    }

    public toString(): string {
        return `def ${this.name}(${this.params.map(param => `${param.name}${param.type !== '' ? (': ' + param.type):''}${(param as PythonMethodParameter).defa !== ''  ? ('=' + (param as PythonMethodParameter).defa) : ''}`).join(', ')})` + (this.type !== '' ? (' -> ' + this.type) : '');
    }
}


class PythonMethod extends Method {
    constructor(container: PythonMethodContainer, sig: PythonMethodSignature, body: string, syntaxNode: SyntaxNode) {
        super(container, sig, body, syntaxNode);
    }

    public copy(): PythonMethod {
        return new PythonMethod(this.container.copy() as PythonMethodContainer, this.signature, this.body, this.syntaxNode);
    }

    public toString(): string {
        return this.signature.toString() + '\n' + this.body;
    }
}

function dfs(current: SyntaxNode, container: PythonMethodContainer): PythonMethod[] {
    let ret: PythonMethod[] = [];
    if(current.type.startsWith('class_definition')) {
        current.children.forEach(child => {
            ret.push(...dfs(child, new PythonMethodContainer(container.filePath, new PythonClass(current.child(1)!.text))));
        });
    } else {
        if(current.type.startsWith('function_definition')) {
            let name = current.child(1)!.text;
            let paramsNode = current.child(2)!;
            let returnType = '';
            current.children.forEach(child => {
                if(child.type === 'type') {
                    returnType = child.text;
                }
            });
            let params: PythonMethodParameter[] = [];
            for(let paramNode of paramsNode.children) {
                if(!paramNode.isNamed) {
                    continue;
                }
                if(paramNode.type === 'identifier') {
                    params.push(new PythonMethodParameter('', paramNode.text, ''));
                } else if(paramNode.type === 'typed_parameter') {
                    params.push(new PythonMethodParameter(paramNode.child(2)!.text, paramNode.child(0)!.text, ''));
                } else if(paramNode.type === 'default_parameter') {
                    params.push(new PythonMethodParameter('', paramNode.child(0)!.text, paramNode.child(2)!.text));
                } else if(paramNode.type === 'typed_default_parameter') {
                    params.push(new PythonMethodParameter(paramNode.child(2)!.text, paramNode.child(0)!.text, paramNode.child(4)!.text));
                }
            }
            ret.push(new PythonMethod(container, new PythonMethodSignature(returnType, name, params), current.lastChild!.text, current));
            
        }
        current.children.forEach(child => {
            ret.push(...dfs(child, container));
        });
    }
    return ret;
}

export function getAllMethods(file: string, current: SyntaxNode): PythonMethod[] {
    let ret = dfs(current, new PythonMethodContainer(file));
    return ret;
}