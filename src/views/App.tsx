import React, { useEffect, useState } from 'react';
import './App.css';
import HistoryList from './HistoryList';
import { MethodHistory } from './Models';
import HistoryDetail from './HistoryDetail';
import LoadingScreen from './LoadingScreen';
import { Button } from '@mui/material';

// App 组件
const App: React.FC = () => {

  const [waitingForHistory, setWaitingForHistory] = useState<boolean>(true);
  const [codeHistory, setCodeHistory] = useState<MethodHistory[]>([]);
  const [currentHistory, setCurrentHistory] = useState<MethodHistory>();
  const [currentPrevious, setCurrentPrevious] = useState<MethodHistory>();
  const [githubToken, setGithubToken] = useState<string>();
  const [repoOwner, setRepoOwner] = useState<string>();
  const [repoName, setRepoName] = useState<string>();
  const [nameLLM, setNameLLM] = useState<string>();
  const [keyLLM, setKeyLLM] = useState<string>();

  const saveAsData = () => {
    const commits = codeHistory.map(h => h.commit.hash);
    const filePath = codeHistory[0].container;
    const expectedResult = new Map<string, string>();
    commits.forEach(commit => expectedResult.set(commit, 'YType'));
    const data = {
      'repositoryName': repoName,
      'filePath': filePath,
      'functionName': '',
      'functionStartLine': 0,
      'startCommitName': '',
      'expectedResult': expectedResult
    };
    console.log(JSON.stringify(data, null, 2));
  };

  useEffect(() => {
    const handler = (event: MessageEvent) => {
        let message = event.data;
        if(message.type === 'setCodeHistory') {
          setCodeHistory(message.codeHistory.map((obj: { commit: Object; code: string; container: string}) => new MethodHistory(obj.commit, obj.code, obj.container)));
          setWaitingForHistory(false);
        } else if(message.type === 'setWaiting' && !waitingForHistory) {
          setWaitingForHistory(true);
        } else if(message.type === 'setGithub') {
          setGithubToken(message.token);
          setRepoOwner(message.repoOwner);
          setRepoName(message.repoName);
        } else if(message.type === 'setLLM') {
          setNameLLM(message.name);
          setKeyLLM(message.key);
        } else {
          console.log(message);
        }
      };
      
    window.addEventListener('message', handler);
    return () => {
      window.removeEventListener('message', handler);
    };
  }, []);
  return (
    <div>
      {
      !waitingForHistory && 
      <div style={{ display: 'flex', height: '100vh', padding: '20px' }}>
        <div style={{ width: '300px', marginRight: '20px', overflowY: 'auto' }}>
          <HistoryList 
            history={codeHistory} 
            clickHandler={(h: MethodHistory, i: number) => {
              setCurrentHistory(h);
              if(i < codeHistory.length - 1) {
                setCurrentPrevious(codeHistory[i + 1]);
              } else {
                setCurrentPrevious(undefined);
              }
            }} 
          />
        </div>
        <Button variant="contained" color="primary" onClick={saveAsData} sx={{ marginLeft: '8px' }}>
            Save
        </Button>

        <div style={{ flex: 1, padding: '20px', borderLeft: '1px solid #ddd', overflowY: 'auto' }}>
          {currentHistory && <HistoryDetail history={currentHistory} previous={currentPrevious} 
          githubToken={githubToken ?? ''} repoName={repoName ?? ''} repoOwner={repoOwner ?? ''}
          nameLLM={nameLLM ?? ''} keyLLM={keyLLM ?? ''}/>}
        </div>
      </div>
      }

      {
      waitingForHistory &&
      <LoadingScreen />
      }

    </div>

  );
};

export default App;