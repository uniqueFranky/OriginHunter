import { getFileContentInCommit, queryInConversations, toolPrefabs } from "./tools";
import { SiliconFlowMessage, ToolInvocation } from "./utils";
import { Post } from "../github/utils";
import { MethodHistory } from "../Models";
import { getFileContent } from "../../git/gitAPI";

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class SiliconFlowChatWrapper {
    nameLLM: string;
    keyLLM: string;
    messages: SiliconFlowMessage[];
    posts: Post[];
    previousMethod?: MethodHistory;
    currentMethod?: MethodHistory;
    mcpPort: number;
    setChatMessages: (messages: SiliconFlowMessage[]) => void;

    constructor(nameLLM: string, keyLLM: string, mcpPort: number, setChatMessages: (messages: SiliconFlowMessage[]) => void) {
        this.nameLLM = nameLLM;
        this.keyLLM = keyLLM;
        this.messages = [];
        this.posts = [];
        this.mcpPort = mcpPort;
        this.setChatMessages = setChatMessages;
    }

    setPosts(posts: Post[]) {
        this.posts = posts;
    }

    setPreviousMethod(previousMethod?: MethodHistory) {
        this.previousMethod = previousMethod;
    }

    setCurrentMethod(currentMethod: MethodHistory) {
        this.currentMethod = currentMethod;
    }

    getSiliconFlowModelName(): string {
        if(this.nameLLM === 'deepseek-coder-v3') {
            return 'Qwen/QwQ-32B';
        } else {
            console.log('no supported LLM');
            return '';
        }
    }
    
    addMessage(role: string, content: string, reasoning_content?: string, tool_calls?: ToolInvocation[]) {
        this.appendMessage(new SiliconFlowMessage(role, content, reasoning_content, tool_calls));
    }

    appendMessage(message: SiliconFlowMessage) {
        this.messages.push(message);
        this.setChatMessages(this.messages);
    }

    getMessages(): SiliconFlowMessage[] {
        return this.messages;
    }

    clear() {
        this.messages = [];
    }

    async fire() {
        const options = {
            method: 'POST',
            headers: {Authorization: this.keyLLM, 'Content-Type': 'application/json'},
            body: JSON.stringify({
                model: this.getSiliconFlowModelName(),
                messages: this.messages,
                tools: toolPrefabs,
            })
        };
        try {
            let response = await fetch('https://api.siliconflow.cn/v1/chat/completions', options);
            let data = await response.json();
            while(data.message) {
                console.log('exceed limit: ' + data.message);
                await sleep(61000);
                response = await fetch('https://api.siliconflow.cn/v1/chat/completions', options);
                data = await response.json();
            }

            const returnedMessage = data.choices[0].message as SiliconFlowMessage;
            console.log(returnedMessage);
            const message = SiliconFlowMessage.fromReturnedMessage(returnedMessage);
            this.appendMessage(message);
            const toolMessagesToAppend: SiliconFlowMessage[] = [];
            for(const inv of message.tool_calls ?? []) {
                toolMessagesToAppend.push(await this.processToolInvocation(inv));
            }
            if(toolMessagesToAppend.length > 0) {
                toolMessagesToAppend.forEach(toolMessage => {
                    this.appendMessage(toolMessage);
                });
                await this.fire();
            }
        } catch(err) {
            console.log(err);
        }
    }

    async processToolInvocation(toolInvocation: ToolInvocation): Promise<SiliconFlowMessage> {
        if(toolInvocation.function.name === 'query_in_conversations') {
            const query = toolInvocation.function.arguments.query;
            const top_k = toolInvocation.function.arguments.top_k;
            const comments = this.posts.map(post => post.comments).flat();
            const retrieved = await queryInConversations(comments, query, top_k, this.keyLLM);
            const ret = new SiliconFlowMessage('tool', `Here is the comments retrieved from GitHub, in json format.
${JSON.stringify(retrieved)}`);
            ret.setToolCallId(toolInvocation.id);
            return ret;
        } else if(toolInvocation.function.name === 'get_file_content_in_commit') {
            const file_path = toolInvocation.function.arguments.file_path;
            const commit = toolInvocation.function.arguments.commit;
            const content = await getFileContentInCommit(this.mcpPort, file_path, commit);
            const ret = new SiliconFlowMessage('tool', `Here is the content of the file ${file_path} in the commit ${commit}:
${content}`);
            ret.setToolCallId(toolInvocation.id);
            return ret;

        } else {
            throw new Error('Unknown tool invocation: ' + toolInvocation.function.name);
        }
    }

    async fireWithUserMessage(message: string) {
        this.addMessage('user', message);
        await this.fire();
    }

    async fireWithToolMessage(message: string) {
        this.addMessage('tool', message);
        await this.fire();
    }
}