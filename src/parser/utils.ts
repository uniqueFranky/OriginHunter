import { SyntaxNode } from "tree-sitter";

export class Parameter {
    type: string;
    name: string;
    constructor(type: string, name: string) {
        this.type = type;
        this.name = name;
    }
    public equals(rhs: Parameter): boolean {
        return this.type === rhs.type && this.name === rhs.name;
    }
}

export enum SupportedLanguage {
    Java
}

export abstract class MethodSignature {
    type: string;
    name: string;
    params: Parameter[];
    language: SupportedLanguage;
    constructor(language: SupportedLanguage, type: string, name: string, params: Parameter[]) {
        this.language = language;
        this.type = type;
        this.name = name;
        this.params = params;
    }

    public equals(rhs: MethodSignature): boolean {
        if(this.language !== rhs.language || this.type !== rhs.type || this.name !== rhs.name || this.params.length !== rhs.params.length) {
            return false;
        }
        for(let i = 0; i < this.params.length; i++) {
            if(!this.params[i].equals(rhs.params[i])) {
                return false;
            }
        }
        return true;
    }

    public toString(): string {
        return `${this.type} ${this.name}(${this.params.map(param => `${param.type} ${param.name}`).join(', ')})`;
    }
}

export abstract class MethodContainer {
    filePath: string;
    constructor(filePath: string) {
        this.filePath = filePath;
    }
    
    public equals(rhs: MethodContainer): boolean {
        return this.filePath === rhs.filePath;
    }

    public abstract copy(): MethodContainer;
}

export abstract class Method {
    container: MethodContainer;
    signature: MethodSignature;
    body: string;
    syntaxNode: SyntaxNode;

    constructor(container: MethodContainer, signature: MethodSignature, body: string, syntaxNode: SyntaxNode) {
        this.container = container;
        this.signature = signature;
        this.body = body;
        this.syntaxNode = syntaxNode;
    }

    public equals(rhs: Method) {
        return this.container.equals(rhs.container) && this.signature.equals(rhs.signature) && this.body === rhs.body;
    }

    public toString(): string {
        return this.signature.toString() + ' ' + this.body;
    }

    public abstract copy(): Method;
}

export function getSupportedLanguageForFile(fileName: string): SupportedLanguage {
    const parts = fileName.split('.');
    const ext = parts[parts.length - 1];
    switch(ext.toLowerCase()) {
        case 'java':
            return SupportedLanguage.Java;
        default:
            throw new Error('Unsupported Language: ' + ext);
    }
}