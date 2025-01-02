import React, { useState } from 'react';
import './App.css';

// 定义代码历史数据类型
const codeHistory: string[] = [
  "console.log('Initial version of the code');",
  "console.log('Added new function to handle data');",
  "console.log('Refactored code for better performance');",
  "console.log('Added error handling and logging');",
  "console.log('Optimized the algorithm');",
  "console.log('Final version with full test coverage');"
];

// App 组件
const App: React.FC = () => {
  // 当前代码的索引
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // 滑动条改变时的回调函数
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentIndex(parseInt(e.target.value, 10));
  };

  return (
    <div className="app">
      <h1>代码历史时间线</h1>
      <div className="timeline-container">
        {/* 时间线 */}
        <div className="timeline">
          {codeHistory.map((code, index) => (
            <div
              key={index}
              className={`timeline-point ${index <= currentIndex ? 'active' : ''}`}
            >
              {index === currentIndex && <div className="dot"></div>}
            </div>
          ))}
        </div>

        {/* 滑动条 */}
        <input
          type="range"
          min="0"
          max={codeHistory.length - 1}
          value={currentIndex}
          onChange={handleSliderChange}
          className="slider"
        />

        {/* 当前代码显示区域 */}
        <div className="code-display">
          <p>{codeHistory[currentIndex]}</p>
        </div>
      </div>
    </div>
  );
};

export default App;
