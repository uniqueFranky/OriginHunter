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
    You have two versions of the same function: one from an earlier commit and one from a later commit. You also have access to the related Issue and Pull Request discussions, which may include other code changes not directly related to the function. Your task is to focus specifically on the provided function and its context.
    
    Please analyze the discussions and extract relevant information related to the function change. If other code changes are mentioned that are closely tied to the function, include them; if the relationship is weak or unclear, do not include them. Pay special attention to the motivations behind the changes.
    
    ### Key aspects to address:
    1. **Reason for the change**: Why was the function modified? What problem (e.g., bug, performance issue) is the change addressing? This is the most important point.
    2. **Developer feedback/suggestions**: What suggestions or concerns did the developers share regarding the function? Were alternative solutions discussed?
    3. **Technical decisions**: What technical choices were made in the function's logic, design, or performance based on the discussions?
    4. **Challenges addressed**: Were there any challenges or specific issues related to the function mentioned in the discussions? How were they resolved?
    5. **Outcome and conclusions**: What conclusions were reached regarding the function change? Were any issues left unresolved?
    
    Remember to **focus only on the function** and its context. If other changes are mentioned, include them **only if they directly affect** the function's behavior or purpose.
    
    ### Important:
    - Your answer doesn't need to address all aspects above, only those specifically discussed.
    - Provide the **source** of your conclusions (e.g., comment author, issue ID).
    
    ---
    
    #### Function in earlier version (${m1.container} ${m1.signature.toString()}):
    ${m1.toString()}
    
    #### Function in later version (${m2.container} ${m2.signature.toString()}):
    ${m2.toString()}
    
    #### Issue and Pull Request discussions:
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