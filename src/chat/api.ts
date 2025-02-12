import ollama from 'ollama';
import * as vscode from 'vscode';
import * as parser from '../parser/utils';

export async function isSameEvolution(m1: parser.Method, m2: parser.Method): Promise<boolean> {
    const prompt = {
        role: 'user',
        content: `You are a skilled programmer, please tell if the following two functions belong to the same evolution process of a certain function. Answer only "yes" or "no".
        The same evolution process means the function may go through rename, parameter change, body change, etc, but the overall funcionality stays stable.
        You will be given one positive example and one negative example, followed by your task.
        [Positive Example]
        Function1:
        private Mono<RememberMeToken> getTokenExtensionForSeries(String seriesId) {
            var listOptions = new ListOptions();
            listOptions.setFieldSelector(FieldSelector.of(equal("spec.series", seriesId)));
            return client.listBy(RememberMeToken.class, listOptions, PageRequestImpl.ofSize(1))
                .flatMap(result -> Mono.justOrEmpty(ListResult.first(result)));
        }
        
        Function2:
        private Mono<RememberMeToken> getTokenExtensionForSeries(String seriesId) {
            var listOptions = ListOptions.builder()
                .fieldQuery(and(equal("spec.series", seriesId),
                    isNull("metadata.deletionTimestamp")
                ))
                .build();
            return client.listBy(RememberMeToken.class, listOptions, PageRequestImpl.ofSize(1))
                .flatMap(result -> Mono.justOrEmpty(ListResult.first(result)));
        }
        
        Thinking: The two functions implements the same funcionality, only that they create list options in different ways.

        Answer: yes

        [Negative Example]
        Function1:
        @Override
        public void register(@NonNull SchemeWatcher watcher) {
            Assert.notNull(watcher, "Scheme watcher must not be null");
            watchers.add(watcher);
        }

        Function2:
        @Override
        public void unregister(@NonNull SchemeWatcher watcher) {
            Assert.notNull(watcher, "Scheme watcher must not be null");
            watchers.remove(watcher);
        }
        
        Thinking: Although the two functions look very similar, they are actually doing the opposite funcionality, i.e., registering an unregistering, thus can never be the same function under evolution.

        Answer: no

        [Your Task]
        Function1:
        ${m1.toString()}

        Function2:
        ${m2.toString()}

        Answer: 
        `
    };

    const modelName = vscode.workspace.getConfiguration('originhunter').get('nameLLM');
    if(!modelName) {
        throw new Error('No LLM name was found.');
    }
    try {
        const response = await ollama.chat({
            model: modelName as string,
            messages: [prompt]
        });
        // console.log(prompt.content);
        // console.log(response.message.content);
        if(response.message.content.toLowerCase().startsWith("yes")) {
            return true;
        } else if(response.message.content.toLowerCase().startsWith("no")) {
            return false;
        } else {
            throw new Error(`unexpected response from LLM: ${response.message.content}`);
        }
    } catch(err) {
        console.log(err);
    }
    return false;
    
}

