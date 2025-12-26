
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BootSequence } from './components/BootSequence';
import { HUD } from './components/HUD';
import { ZenithMode } from './components/Physics/ZenithMode';
import { SessionReport } from './components/SessionReport';
import { AnalysisState, SessionData } from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AnalysisState>(AnalysisState.BOOT);
  const [zenithActive, setZenithActive] = useState(false);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const keyBuffer = useRef<string>("");

  // Secret code trigger for Zenith Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keyBuffer.current += e.key.toLowerCase();
      if (keyBuffer.current.includes("zenith")) {
        setZenithActive(prev => !prev);
        keyBuffer.current = "";
      }
      if (keyBuffer.current.length > 10) {
        keyBuffer.current = keyBuffer.current.slice(-10);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleBootComplete = useCallback(() => {
    setAppState(AnalysisState.READY);
  }, []);

  const handleStartAnalysis = useCallback(() => {
    setAppState(AnalysisState.ANALYZING);
  }, []);

  const handleStopAnalysis = useCallback((data: SessionData) => {
    setSessionData(data);
    setAppState(AnalysisState.REPORT);
  }, []);

  const handleReset = useCallback(() => {
    setSessionData(null);
    setAppState(AnalysisState.READY);
  }, []);

  return (
    <div className="relative w-full h-full bg-transparent overflow-hidden font-mono text-[#00ff41]">
      {/* Zenith Mode Layer (Physics) */}
      {zenithActive && <ZenithMode onClose={() => setZenithActive(false)} />}

      {/* Main Flow */}
      {appState === AnalysisState.BOOT && (
        <BootSequence onComplete={handleBootComplete} />
      )}

      {appState === AnalysisState.READY && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full space-y-12 animate-in fade-in duration-1000">
          <div className="text-center space-y-4">
            <h1 className="text-7xl md:text-8xl font-black tracking-tighter glitch-text tech-flicker">
              ZENITH NEURAL-VISION
            </h1>
            <div className="flex items-center justify-center space-x-4 opacity-70">
              <div className="h-[1px] w-12 bg-[#00ff41]" />
              <p className="text-xs font-bold tracking-[0.4em] uppercase">SYSTEM_READY // AWAITING_INITIALIZATION</p>
              <div className="h-[1px] w-12 bg-[#00ff41]" />
            </div>
          </div>

          <div className="group relative">
             <div className="absolute -inset-1 bg-[#00ff41] opacity-20 blur-lg group-hover:opacity-40 transition-opacity" />
             <button 
                onClick={handleStartAnalysis}
                className="relative px-16 py-6 border-2 border-[#00ff41] bg-black/40 backdrop-blur-md hover:bg-[#00ff41] hover:text-black transition-all duration-300 font-black text-2xl uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(0,255,65,0.3)]"
              >
                START ANALYSIS
              </button>
          </div>

          {/* Bottom Branding */}
          <div className="absolute bottom-12 text-[10px] opacity-30 tracking-[0.8em] font-black uppercase pointer-events-none">
            Behavioral_Core_v3.1 // Orewa_Zenith
          </div>
        </div>
      )}

      {appState === AnalysisState.ANALYZING && (
        <HUD onStop={handleStopAnalysis} />
      )}

      {appState === AnalysisState.REPORT && sessionData && (
        <SessionReport data={sessionData} onReset={handleReset} />
      )}
    </div>
  );
};

export default App;
