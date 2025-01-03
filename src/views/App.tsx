import React, { useEffect, useState } from 'react';
import './App.css';
import HistoryList from './HistoryList';
import { MethodHistory } from './Models';
import HistoryDetail from './HistoryDetail';

// App 组件
const App: React.FC = () => {

  const [codeHistory, setCodeHistory] = useState<MethodHistory[]>([]);
  const [currentHistory, setCurrentHistory] = useState<MethodHistory>();

  window.addEventListener('message', event => {
    let message = event.data;
    if(message.type === 'setCodeHistory') {
      setCodeHistory(message.codeHistory.map((obj: { commit: Object; code: string; }) => new MethodHistory(obj.commit, obj.code)));
    } else {
      console.log(message);
    }
  });

  return (
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
  );
};

export default App;