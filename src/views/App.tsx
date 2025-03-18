import React, { useEffect, useState } from 'react';
import './App.css';
import HistoryList from './HistoryList';
import { MethodHistory } from './Models';
import HistoryDetail from './HistoryDetail';
import LoadingScreen from './LoadingScreen';

declare const acquireVsCodeApi: () => {
  postMessage(message: any, transfer?: Transferable[]): void;
};

var vscode: any = undefined;

// App 组件
const App: React.FC = () => {

  const [waitingForHistory, setWaitingForHistory] = useState<boolean>(true);
  const [codeHistory, setCodeHistory] = useState<MethodHistory[]>([]);
  const [currentHistory, setCurrentHistory] = useState<MethodHistory>();
  const [currentPrevious, setCurrentPrevious] = useState<MethodHistory>();

  window.addEventListener('message', event => {
    let message = event.data;
    if(message.type === 'setCodeHistory') {
      setCodeHistory(message.codeHistory.map((obj: { commit: Object; code: string; container: string}) => new MethodHistory(obj.commit, obj.code, obj.container)));
      setWaitingForHistory(false);
    } else if(message.type === 'setWaiting') {
      setWaitingForHistory(true);
    } else {
      console.log(message);
    }
  });
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

        <div style={{ flex: 1, padding: '20px', borderLeft: '1px solid #ddd', overflowY: 'auto' }}>
          {currentHistory && <HistoryDetail history={currentHistory} previous={currentPrevious} />}
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