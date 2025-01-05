import React, { useEffect, useState } from 'react';
import './App.css';
import HistoryList from './HistoryList';
import { MethodHistory } from './Models';
import HistoryDetail from './HistoryDetail';
import LoadingScreen from './LoadingScreen';

// App 组件
const App: React.FC = () => {

  const [waitingForHistory, setWaitingForHistory] = useState<boolean>(true);
  const [codeHistory, setCodeHistory] = useState<MethodHistory[]>([]);
  const [currentHistory, setCurrentHistory] = useState<MethodHistory>();

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
            clickHandler={(h: MethodHistory) => { setCurrentHistory(h); }} 
          />
        </div>

        <div style={{ flex: 1, padding: '20px', borderLeft: '1px solid #ddd', overflowY: 'auto' }}>
          {currentHistory && <HistoryDetail history={currentHistory} />}
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