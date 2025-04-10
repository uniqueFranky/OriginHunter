import { json } from "stream/consumers";
import { Comment, Post } from "../github/utils";
import { ToolInvocation } from "./utils";
import { Query } from "tree-sitter";

export const toolPrefabs = [
  {
    type: 'function',
    function: {
      name: 'query_in_conversations',
      description: 'Retrieves most relevant conversations from the issues or pull requests by BERT embeddings.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The query to search for in the conversations.',
          },
          top_k: {
            type: 'int',
            description: 'The number of top conversations to retrieve.',
          },
        },
        required: ['query', 'top_k'],
        strict: true,
      },
    },
  },
];


export async function queryInConversations(comments: Comment[], query: string, top_k: number, keyLLM: string): Promise<Comment[]> {
  const options = {
    method: 'POST',
    headers: {Authorization: keyLLM, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      model: 'BAAI/bge-reranker-v2-m3',
      query: query,
      documents: comments.map(comment => JSON.stringify(comment)),
      top_n: top_k,
      return_documents: false
    }),
  };
  console.log('retrieving relevant comments');
  let response = await fetch('https://api.siliconflow.cn/v1/rerank', options);
  let data = await response.json();
  const ret = data['results'].map((result: {index: number, relevance_score: number}) => comments[result['index']]);
  console.log(ret.length);
  return ret;
}