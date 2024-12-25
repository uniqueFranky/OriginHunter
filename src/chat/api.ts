import ollama from 'ollama';
import * as vscode from 'vscode';
import * as parser from '../parser/utils';

export async function isSameEvolution(m1: parser.Method, m2: parser.Method): Promise<boolean> {
    const prompt = {
        role: 'user',
        content: `You are a skilled programmer, please tell if the following two functions belong to the same evolution process of a certain function. Answer only "yes" or "no".
        Function1:
        ${m1.toString()}

        Function2:
        ${m2.toString()}
        `
    };

    const modelName = vscode.workspace.getConfiguration('originhunter').get('nameLLM');
    if(!modelName) {
        throw new Error('No LLM name was found.');
    }
    const response = await ollama.chat({
        model: modelName as string,
        messages: [prompt]
    });
    if(response.message.content.toLowerCase().startsWith("yes")) {
        return true;
    } else if(response.message.content.toLowerCase().startsWith("no")) {
        return false;
    } else {
        throw new Error(`unexpected response from LLM: ${response.message.content}`);
    }
}

