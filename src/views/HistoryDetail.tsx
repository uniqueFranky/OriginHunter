import React, { useEffect, useState } from 'react';
import { Box, Typography, TextField, Button, Tabs, Tab, Input } from '@mui/material';
import { MethodHistory } from './Models';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import DiffViewer from 'react-diff-viewer';
import * as github from './github/api';
import { Post, Comment } from './github/utils';
import { SiliconFlowChatWrapper } from './chat/wrapper';
import { chat } from 'vscode';
import { SiliconFlowMessage } from './chat/utils';

interface HistoryDetailProps {
  history: MethodHistory;
  previous: MethodHistory | undefined;
  githubToken: string;
  repoName: string;
  repoOwner: string;
  nameLLM: string;
  keyLLM: string;
  mcpPort: number;
}

declare function acquireVsCodeApi(): any;

let posts: Post[] = [];
let vscode: any = undefined;
let chatWrapper: SiliconFlowChatWrapper = new SiliconFlowChatWrapper('', '', 3456, (messages: SiliconFlowMessage[]) => {}); 


const HistoryDetail: React.FC<HistoryDetailProps> = ({ history, previous, githubToken, repoName, repoOwner, nameLLM, keyLLM, mcpPort }) => {
  const [inputMessage, setInputMessage] = useState('');
  const [tabIndex, setTabIndex] = useState(0);
  const [messages, setMessages] = useState<SiliconFlowMessage[]>([]);

  const init = async (props: HistoryDetailProps) => {
    posts = await github.getPosts(props.history.commit.hash, props.githubToken, props.repoName, props.repoOwner);
    chatWrapper = new SiliconFlowChatWrapper(props.nameLLM, props.keyLLM, mcpPort, (newChatMessages: SiliconFlowMessage[]) => {
      setMessages(newChatMessages);
      console.log('set messages');
      console.log(newChatMessages);
    });
    chatWrapper.setPosts(posts);
    chatWrapper.setPreviousMethod(props.previous);
    chatWrapper.setCurrentMethod(props.history);
    chatWrapper.addMessage('system', `
You are a helpful assistant designed to assist the user in understanding code changes and summarizing discussions from GitHub issues and pull requests. You have access to various tools for retrieving detailed information from the code, git repository, and conversations. 

You can call these tools multiple times as needed to gather information. Always prioritize citing specific conversations over generating your own content. If you cannot answer a question, use the tools to gather the necessary details.
`);
    const userMessage = `
<instruction>
You have two versions of the same function: one from an earlier commit and one from a later commit. Additionally, you have access to discussions from the related Issue and Pull Request, which may include other changes not directly tied to the provided function.
Your task is to analyze the discussions and extract the following insights specifically related to the provided function. If other changes are mentioned and are closely tied to the function, include them in your analysis; if their relationship is weak or unclear, exclude them.

1. **Reason for the Change**: Why was this function modified? What problem or improvement is being addressed? Look for mentions of bugs, performance issues, or feature requests.
2. **Developer Feedback**: What feedback or suggestions did developers share regarding the function? Were any alternative approaches discussed or considered?
3. **Technical Decisions**: What decisions were made about the function’s design, logic, or performance in the discussions? Highlight any key trade-offs.
4. **Challenges or Issues Addressed**: Were any specific challenges with the function discussed? How were these challenges resolved or mitigated in the change?
5. **Outcome and Conclusions**: What are the key takeaways from the discussion? Were there any final conclusions about modifying the function, or any unresolved issues?

<instruction>

<reminder>
Start by calling the "query_in_conversations" tool, and use other tools if needed. You can make multiple calls as necessary.
</reminder>

<task>
**Function in earlier commit** (Commit: ${props.previous ? props.previous.commit.hash : "None (new function)"}, File: ${props.previous? props.previous.container : 'No file (newly introduced)'}):
<function>
${props.previous ? props.previous.code : 'No function (newly introduced)'}
</function>

**Function in later commit** (Commit: ${props.history.commit.hash}, File: ${props.history.container}):
<function>
${props.history!.code}
</function>
</task>
    `;
    
    await chatWrapper.fireWithUserMessage(userMessage);
};
  const initChat = () => {
    init({history, previous, githubToken, repoName, repoOwner, nameLLM, keyLLM, mcpPort});
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) {
      return;
    }
    setInputMessage('');
    await chatWrapper.fireWithUserMessage(inputMessage);
  };

  const saveAsData = async () => {
    if(vscode === undefined) {
      vscode = acquireVsCodeApi();
    }

    let d = {
      repoName: repoName,
      repoOwner: repoOwner,
      previous: previous,
      current: history,
      posts: posts,
      agentSum: messages[messages.length - 1]
    };
    let fileName = repoName + '-' + history.commit.hash + '.json';
    vscode.postMessage({'type': 'saveData', 'data': JSON.stringify(d), 'path': fileName});
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px' }}>
      {/* Tabs Navigation */}
      <Tabs value={tabIndex} onChange={(_, newValue) => setTabIndex(newValue)}>
        <Tab label="Commit Message" color='white' />
        <Tab label="Commit Code" color='white' />
        <Tab label="AI Chat" color='white' />
      </Tabs>

      {/* Tab Content */}
      {tabIndex === 0 && (
        <Box sx={{ padding: '16px', border: '1px solid #ddd', borderRadius: '4px', marginTop: '16px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          <Typography variant="body2">{history.commit.message}</Typography>
        </Box>
      )}

      {tabIndex === 1 && (
        <Box sx={{ maxHeight: '800px', overflowY: 'auto', border: '1px solid #ddd', padding: '8px', borderRadius: '4px', marginTop: '16px', backgroundColor: '#f5f5f5', fontFamily: 'monospace', fontSize: '14px' }}>
          {!previous ? (
            <SyntaxHighlighter language="java" style={dark}>
              {history.code}
            </SyntaxHighlighter>
          ) : (
            <DiffViewer oldValue={previous.code} newValue={history.code} splitView={true} />
          )}
        </Box>
      )}

      {tabIndex === 2 && (
        <Box sx={{ minHeight: '400px', maxHeight: '800px', border: '1px solid #ddd', padding: '8px', borderRadius: '4px', overflowY: 'auto', marginTop: '16px', display: 'flex', flexDirection: 'column', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {messages.map((msg, index) => (
            <Box
              key={index}
              sx={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : msg.role === 'tool' ? 'center' : 'flex-start',
                margin: '4px 0',
              }}
            >
              {msg.role === 'tool' ? (
                <Typography
                  variant="body2"
                  sx={{
                    display: 'inline-block',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#f0f0f0',
                    color: 'black',
                    fontStyle: 'italic',
                    textAlign: 'left',
                  }}
                >
                  <strong>Tool Call:</strong> {JSON.stringify(msg.tool_call_id)}
                </Typography>
              ) : (
                <Typography
                  variant="body2"
                  sx={{
                    display: 'inline-block',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: msg.role === 'user' ? '#2196f3' : '#eee',
                    color: msg.role === 'user' ? 'white' : 'black',
                    textAlign: 'left',
                  }}
                >
                  <strong>{msg.role}:</strong> {msg.tool_calls ? msg.reasoning_content! : msg.content}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}

      {tabIndex === 2 && (
        <Box sx={{ display: 'flex', marginTop: '8px' }}>
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask AI..."
          />
          <Button variant="contained" color="primary" onClick={initChat} sx={{ marginLeft: '8px' }}>
            Init
          </Button>
          <Button variant="contained" color="primary" onClick={sendMessage} sx={{ marginLeft: '8px' }}>
            Send
          </Button>
          <Button variant="contained" color="primary" onClick={saveAsData} sx={{ marginLeft: '8px' }}>
            Save
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default HistoryDetail;