import React, { useState, useEffect } from 'react';

interface BootSequenceProps {
  onComplete: () => void;
}

const BOOT_LOGS = [
  "[SYSTEM_INITIATING...]",
  "Welcome, Touseef Panjtan.",
  "Analyzing human behavioral patterns...",
  "Calibrating Iris Tracking...",
  "Syncing Vocal Frequency Database...",
  "Objective: Measure the Zenith of your confidence.",
  "Status: Awaiting Camera Access Authorization...",
  "LOADING_NEURAL_VISION_CORE... 100%",
];

export const BootSequence: React.FC<BootSequenceProps> = ({ onComplete }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < BOOT_LOGS.length) {
      const timer = setTimeout(() => {
        setLogs(prev => [...prev, BOOT_LOGS[currentIndex]]);
        setCurrentIndex(prev => prev + 1);
      }, 400);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(onComplete, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, onComplete]);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-black p-4 z-50">
      <div className="w-full max-w-2xl font-mono text-lg space-y-2">
        {logs.map((log, i) => (
          <div key={i} className="flex space-x-2">
            <span className="text-[#00ff41] animate-pulse">{">"}</span>
            <span className={i === logs.length - 1 ? "font-bold text-white" : ""}>
              {log}
            </span>
          </div>
        ))}
        {currentIndex < BOOT_LOGS.length && (
          <div className="w-2 h-6 bg-[#00ff41] animate-blink" />
        )}
      </div>
    </div>
  );
};