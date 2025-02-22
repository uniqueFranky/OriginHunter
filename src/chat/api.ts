import ollama from 'ollama';
import * as vscode from 'vscode';
import * as parser from '../parser/utils';

export async function isSameEvolution(m1: parser.Method, m2: parser.Method): Promise<boolean> {
    const prompt = {
        role: 'user',
        content: `You are a skilled programmer. Please determine if the following two functions are part of the same evolution process of a function. Answer with "yes" or "no".

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

        Answer:
        (ONLY yes or no)

        `
    };

    const modelName = vscode.workspace.getConfiguration('originhunter').get('nameLLM');
    if(!modelName) {
        throw new Error('No LLM name was found.');
    }
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
    return false;
    
}

