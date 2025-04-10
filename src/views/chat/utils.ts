export class ToolInvocation {
    id: string;
    type: string;
    function: {
        name: string;
        arguments: any;
    };

    constructor(id: string, type: string, funcName: string, funcArgs: string) {
        this.id = id;
        this.type = type;
        this.function = {
            name: funcName,
            arguments: JSON.parse(funcArgs),
        };
    }

    toJSON() {
        return {
            id: this.id,
            type: this.type,
            function: {
                name: this.function.name,
                arguments: JSON.stringify(this.function.arguments),
            },
        };
    }
}

export class SiliconFlowMessage {
    role: string;
    content: string;
    reasoning_content?: string;
    tool_calls?: ToolInvocation[];
    tool_call_id?: string;
    constructor(role: string, content: string, reasoning_content?: string, tool_calls?: ToolInvocation[]) {
        this.role = role;
        this.content = content;
        this.reasoning_content = reasoning_content;
        this.tool_calls = tool_calls;
    }

    setToolCallId(tool_call_id: string) {
        this.tool_call_id = tool_call_id;
    }
    
    static fromReturnedMessage(message: any): SiliconFlowMessage {
        const role = message.role;
        const content = message.content;
        let reasoning_content = undefined;
        if (message.reasoning_content) {
            reasoning_content = message.reasoning_content;
        }
        let tool_calls = undefined;
        if (message.tool_calls) {
            tool_calls = message.tool_calls.map((inv: any) => new ToolInvocation(inv.id, inv.type, inv.function.name, inv.function.arguments));
        }
        return new SiliconFlowMessage(role, content, reasoning_content, tool_calls);
    }
}
