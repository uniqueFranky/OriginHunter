import ollama from 'ollama';
import * as vscode from 'vscode';
import * as parser from '../parser/utils';
import { setTimeout } from 'timers';
import { Post } from '../views/github/utils';

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));

}
export async function isSameEvolution(m1: parser.Method, m2: parser.Method): Promise<boolean> {
    const prompt = {
        role: 'user',
        content: `You are a skilled programmer. Please determine if the following two functions are part of the same evolution process of a function.  Answer with "yes" or "no" only. Do not include any additional explanation or reasoning.

        The "same evolution process" means that the functions may have undergone changes like renaming, parameter modifications, or internal body changes, but their overall behavior and functionality remain the same.

        These two functions are from two different commits in a git repository. Your task is to analyze whether they belong to the same function evolution process based on their code differences.

        You will be provided with one positive example and one negative example to clarify the task.

        [Positive Example]
        Function1 (from commit A):
        private Mono<RememberMeToken> getTokenExtensionForSeries(String seriesId) {
            var listOptions = new ListOptions();
            listOptions.setFieldSelector(FieldSelector.of(equal("spec.series", seriesId)));
            return client.listBy(RememberMeToken.class, listOptions, PageRequestImpl.ofSize(1))
            .flatMap(result -> Mono.justOrEmpty(ListResult.first(result)));
        }

        Function2 (from commit B):
        private Mono<RememberMeToken> getTokenExtensionForSeries(String seriesId) {
            var listOptions = ListOptions.builder()
            .fieldQuery(and(equal("spec.series", seriesId), isNull("metadata.deletionTimestamp")))
            .build();
            return client.listBy(RememberMeToken.class, listOptions, PageRequestImpl.ofSize(1))
            .flatMap(result -> Mono.justOrEmpty(ListResult.first(result)));
        }

        Thinking: Both functions implement the same core functionality: retrieving a RememberMeToken based on the series ID. The main difference is how the listOptions are created. Despite this difference, the overall functionality remains unchanged, meaning these two versions belong to the same function evolution.

        Answer: yes

        [Negative Example]
        Function1 (from commit A):
        @Override
        public void register(@NonNull SchemeWatcher watcher) {
            Assert.notNull(watcher, "Scheme watcher must not be null");
            watchers.add(watcher);
        }

        Function2 (from commit B):
        @Override
        public void unregister(@NonNull SchemeWatcher watcher) {
            Assert.notNull(watcher, "Scheme watcher must not be null");
            watchers.remove(watcher);
        }

        Thinking: These two functions look similar but perform opposite actions: one registers a watcher while the other unregisters it. Although they share a similar structure, they perform opposite operations, which means they do not belong to the same evolution process.

        Answer: no

        [Your Task]
        Function1 (from commit A):
        ${m1.toString()}

        Function2 (from commit B):
        ${m2.toString()}

        Answer (Only ouput a single token: yes or no):
        

        `
    };

    const modelName = vscode.workspace.getConfiguration('originhunter').get('nameLLM');
    if(!modelName) {
        throw new Error('No LLM name was found.');
    }
    const apiKey = vscode.workspace.getConfiguration('originhunter').get<string>('apiKey');
    if(!apiKey) {
        throw new Error('No API Key was found.');
    }
    if(modelName === 'deepseek-coder-v3') {
        const options = {
            method: 'POST',
            headers: {
              Authorization: apiKey,
              'Content-Type': 'application/json'
            },
            body: `{"model":"Pro/deepseek-ai/DeepSeek-V3","messages":[${JSON.stringify(prompt)}],"max_tokens":20}`
          };
          try {
            let response = await fetch('https://api.siliconflow.cn/v1/chat/completions', options);
            let data = await response.json();
            console.log(data);
            while(data.message) {
                console.log('exceed limit: ' + data.message);
                await sleep(61000);
                response = await fetch('https://api.siliconflow.cn/v1/chat/completions', options);
                data = await response.json();
            }
            const txt = data.choices[0].message.content;
            if(txt.trim().toLowerCase().startsWith("yes")) {
                return true;
            } else if(txt.trim().toLowerCase().startsWith("no")) {
                return false;
            } else {
                throw new Error(`unexpected response from LLM: ${txt}`);
            }
          } catch(err) {
            console.log(err);
          }
    } else {
        try {
            const response = await ollama.chat({
                model: modelName as string,
                messages: [prompt],
            });
            // console.log(prompt.content);
            // console.log(response.message.content);
            if(response.message.content.trim().toLowerCase().startsWith("yes")) {
                return true;
            } else if(response.message.content.trim().toLowerCase().startsWith("no")) {
                return false;
            } else {
                throw new Error(`unexpected response from LLM: ${response.message.content}`);
            }
        } catch(err) {
            console.log(err);
        }
    }
    
    return false;
    
}

export async function summarizeConversation(m1: parser.Method, m2: parser.Method, posts: Post[]): Promise<string> {
    const prompt = {
        role: 'user',
        content: `
        You are provided with two versions of the same function, one from an earlier commit and the other from a later commit. Additionally, you have access to the related Issue and Pull Request discussions, which may include other code changes not directly related to the provided function.
        Your task is to focus on analyzing the discussions and extracting the following information specifically related to the provided function. If other code changes are mentioned in the discussion and are closely tied to the function, include them in your analysis; if the relationship is weak or unclear, do not include those changes in your output. Pay particular attention to the motivation behind the code changes.
        1. Reason for the change: What is the core motivation for modifying the provided function? Why was this change necessary or requested? This is the most important aspect of the analysis. Look for any issues, bugs, or performance concerns that the function change is intended to address.
        2. Developer suggestions or feedback: What suggestions, concerns, or feedback were provided by the developers regarding the function? Were alternative approaches considered or discussed for implementing the change?
        3. Technical decisions: What technical decisions were made in the discussions related to the function? This could include decisions about the function’s logic, design, or performance considerations.
        4. Challenges or issues addressed by the function change: Were any challenges specific to the function mentioned during the discussion? How were these challenges resolved or mitigated in the code change?
        5. Outcome and conclusions: What were the key takeaways regarding the function change from the discussion? Were there any conclusions on how the function should be modified, or were there any unresolved issues?
        Remember to focus your analysis only on the function provided and its related context. If the discussion includes other code changes, include them only if they are directly relevant to the function or if they significantly affect its behavior or purpose.

        Function in the earlier version:
        ${m1.toString()}

        Function in the later version:
        ${m2.toString()}


        Conversations in Issues and Pull Requests:

        ${JSON.stringify(posts, null, '\t')};
        `
    };
    const modelName = vscode.workspace.getConfiguration('originhunter').get('nameLLM');
    if(!modelName) {
        throw new Error('No LLM name was found.');
    }
    const apiKey = vscode.workspace.getConfiguration('originhunter').get<string>('apiKey');
    if(!apiKey) {
        throw new Error('No API Key was found.');
    }
    if(modelName === 'deepseek-coder-v3') {
        const options = {
            method: 'POST',
            headers: {
              Authorization: apiKey,
              'Content-Type': 'application/json'
            },
            body: `{"model":"Pro/deepseek-ai/DeepSeek-V3","messages":[${JSON.stringify(prompt)}],"max_tokens":4096}`
          };
          try {
            let response = await fetch('https://api.siliconflow.cn/v1/chat/completions', options);
            let data = await response.json();
            console.log(data);
            while(data.message) {
                console.log('exceed limit: ' + data.message);
                await sleep(61000);
                response = await fetch('https://api.siliconflow.cn/v1/chat/completions', options);
                data = await response.json();
            }
            const txt = data.choices[0].message.content;
            return txt;
          } catch(err) {
            console.log(err);
          }
    } else {
        try {
            const response = await ollama.chat({
                model: modelName as string,
                messages: [prompt],
            });
            return response.message.content;
        } catch(err) {
            console.log(err);
        }
    }
    return "";
}