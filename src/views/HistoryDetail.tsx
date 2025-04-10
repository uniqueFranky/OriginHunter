import React, { useEffect, useState } from 'react';
import { Box, Typography, TextField, Button, Tabs, Tab, Input } from '@mui/material';
import { MethodHistory } from './Models';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import DiffViewer from 'react-diff-viewer';
import * as github from './github/api';
import { Post, Comment } from './github/utils';
import path from 'path';

interface HistoryDetailProps {
  history: MethodHistory;
  previous: MethodHistory | undefined;
  githubToken: string;
  repoName: string;
  repoOwner: string;
  nameLLM: string;
  keyLLM: string;
}

declare function acquireVsCodeApi(): any;

let posts: Post[] = [];
let vscode: any = undefined;

const init = async (props: HistoryDetailProps): Promise<[{sender: string; text: string}[], {sender: string; text: string}[]]> => {
    
    posts = await github.getPosts(props.githubToken, props.repoName, props.repoOwner, props.history.commit.hash);
    console.log(posts);
    return [[], []];
  //   const prompt = {
  //     role: 'user',
  //     content: `
  //     You are provided with two versions of the same function, one from an earlier commit and the other from a later commit. Additionally, you have access to the related Issue and Pull Request discussions, which may include other code changes not directly related to the provided function.
  //     Your task is to focus on analyzing the discussions and extracting the following information specifically related to the provided function. If other code changes are mentioned in the discussion and are closely tied to the function, include them in your analysis; if the relationship is weak or unclear, do not include those changes in your output. Pay particular attention to the motivation behind the code changes.
  //     1. Reason for the change: What is the core motivation for modifying the provided function? Why was this change necessary or requested? This is the most important aspect of the analysis. Look for any issues, bugs, or performance concerns that the function change is intended to address.
  //     2. Developer suggestions or feedback: What suggestions, concerns, or feedback were provided by the developers regarding the function? Were alternative approaches considered or discussed for implementing the change?
  //     3. Technical decisions: What technical decisions were made in the discussions related to the function? This could include decisions about the function’s logic, design, or performance considerations.
  //     4. Challenges or issues addressed by the function change: Were any challenges specific to the function mentioned during the discussion? How were these challenges resolved or mitigated in the code change?
  //     5. Outcome and conclusions: What were the key takeaways regarding the function change from the discussion? Were there any conclusions on how the function should be modified, or were there any unresolved issues?
  //     Remember to focus your analysis only on the function provided and its related context. If the discussion includes other code changes, include them only if they are directly relevant to the function or if they significantly affect its behavior or purpose.

  //     Function in the earlier version:
  //     ${props.previous? props.previous.code : 'None, the function is newly introduced'}

  //     Function in the later version:
  //     ${props.history!.code}

  //     Conversations in Issues and Pull Requests:
  //     ${JSON.stringify(posts, null, '\t')};
  //     `
  // };
  // console.log('waiting for summarization');
  // const res = await github.summarizeConversation(prompt, posts, props.nameLLM, props.keyLLM);
  // return [[{'sender': 'User', 'text': 'Help me summarize the changes.'}, {'sender': 'AI Agent', 'text': res}], [{'sender': 'User', 'text': prompt.content}, {'sender': 'AI Agent', 'text': res}]];
};

const HistoryDetail: React.FC<HistoryDetailProps> = ({ history, previous, githubToken, repoName, repoOwner, nameLLM, keyLLM }) => {
  const [chatMessages, setChatMessages] = useState<{ sender: string; text: string }[]>([]);
  const [displayMessages, setDisplayMessages] = useState<{ sender: string; text: string }[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [tabIndex, setTabIndex] = useState(0);
  
  const initChat = () => {
    setDisplayMessages([{'sender': 'User', 'text': 'Help me summarize the changes'}]);
    init({history, previous, githubToken, repoName, repoOwner, nameLLM, keyLLM}).then(res => {
      let [disp, stor] = res;
      setDisplayMessages(disp);
      setChatMessages(stor);
    });
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) {
      return;
    }
    const userMessage = { sender: 'User', text: inputMessage };
    setInputMessage('');
    
    const chatMessagesReplica = chatMessages;
    const displayMessagesReplica = displayMessages;

    github.multipleChat([...chatMessagesReplica, userMessage], nameLLM, keyLLM).then(aiResponse => {
      setChatMessages([...chatMessagesReplica, userMessage, {'sender': 'AI Agent', 'text': aiResponse}]);
      setDisplayMessages([...displayMessagesReplica, userMessage, {'sender': 'AI Agent', 'text': aiResponse}]);
    });
    setChatMessages([...chatMessagesReplica, userMessage]);
    setDisplayMessages([...displayMessagesReplica, userMessage]);
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
      agentSum: chatMessages[chatMessages.length - 1]
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
          {displayMessages.map((msg, index) => (
            <Box key={index} sx={{ textAlign: msg.sender === 'User' ? 'right' : 'left', margin: '4px 0' }}>
              <Typography variant="body2" sx={{ display: 'inline-block', padding: '4px 8px', borderRadius: '4px', backgroundColor: msg.sender === 'User' ? '#2196f3' : '#eee', color: msg.sender === 'User' ? 'white' : 'black' }}>
                <strong>{msg.sender}:</strong> {msg.text}
              </Typography>
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