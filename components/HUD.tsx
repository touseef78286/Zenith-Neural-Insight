
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Activity, MessageSquare, AlertTriangle, Play, Square, CameraOff, MicOff, RefreshCw, Zap, Target, Crosshair } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { SessionData, MetricSnapshot } from '../types';

interface HUDProps {
  onStop: (data: SessionData) => void;
}

const FILLER_WORDS = ['umm', 'ahh', 'like', 'oh', 'basically', 'actually'];

export const HUD: React.FC<HUDProps> = ({ onStop }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const faceMeshRef = useRef<any>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [confidence, setConfidence] = useState(75);
  const [emotionStability, setEmotionStability] = useState(85);
  const [eyeContact, setEyeContact] = useState(false);
  const [trackingAccuracy, setTrackingAccuracy] = useState(0.8);
  const [bpm, setBpm] = useState(72);
  const [fillerCount, setFillerCount] = useState<Record<string, number>>({});
  const [metricsHistory, setMetricsHistory] = useState<MetricSnapshot[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [flash, setFlash] = useState(false);
  const [volume, setVolume] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [eyeVector, setEyeVector] = useState({ x: 0, y: 0, z: 0 });

  const statsInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTime = useRef<number>(0);
  const lastLandmarks = useRef<any>(null);
  const jitterRef = useRef<number>(0);
  const assistantVoiceTriggered = useRef<boolean>(false);
  const lowStabilityCounter = useRef<number>(0);

  const addLog = (msg: string) => {
    setLogs(prev => [`[AI_LOG]: ${msg}`, ...prev].slice(0, 5));
  };

  const triggerAssistantVoice = useCallback((message: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 0.9;
      utterance.pitch = 0.85;
      utterance.volume = 0.6;
      window.speechSynthesis.speak(utterance);
      addLog(`Assistant: ${message}`);
    }
  }, []);

  const initSystem = useCallback(async () => {
    setPermissionError(null);
    try {
      if (!videoRef.current || !canvasRef.current) return;

      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

      // @ts-ignore
      const faceMesh = new window.FaceMesh({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });
      faceMeshRef.current = faceMesh;

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });

      faceMesh.onResults((results: any) => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video) return;
        
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const canvasCtx = canvas.getContext('2d')!;
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
          const landmarks = results.multiFaceLandmarks[0];
          
          // DRAWING NEURAL MESH (NEON GREEN)
          
          // 1. Structural Tesselation (Background Grid)
          // @ts-ignore
          window.drawConnectors(canvasCtx, landmarks, window.FACEMESH_TESSELATION, {color: '#00ff4115', lineWidth: 0.5});
          
          // 2. Primary Facial Contours (Includes eyes, eyebrows, lips, face oval)
          // @ts-ignore
          window.drawConnectors(canvasCtx, landmarks, window.FACEMESH_CONTOURS, {color: '#00ff4188', lineWidth: 1.0});

          // 3. High-Intensity Specific Features
          // @ts-ignore
          window.drawConnectors(canvasCtx, landmarks, window.FACEMESH_LEFT_EYE, {color: '#00ff41', lineWidth: 1.5});
          // @ts-ignore
          window.drawConnectors(canvasCtx, landmarks, window.FACEMESH_RIGHT_EYE, {color: '#00ff41', lineWidth: 1.5});
          // @ts-ignore
          window.drawConnectors(canvasCtx, landmarks, window.FACEMESH_LIPS, {color: '#00ff41', lineWidth: 1.5});

          // 4. Iris & Gaze Tracking Overlays
          const drawIrisCrosshair = (irisCenter: any) => {
            const x = irisCenter.x * canvas.width;
            const y = irisCenter.y * canvas.height;
            const size = 6;
            canvasCtx.strokeStyle = '#ff0000';
            canvasCtx.lineWidth = 1;
            canvasCtx.beginPath();
            canvasCtx.moveTo(x - size, y);
            canvasCtx.lineTo(x + size, y);
            canvasCtx.moveTo(x, y - size);
            canvasCtx.lineTo(x, y + size);
            canvasCtx.stroke();
            
            // Outer glow ring
            canvasCtx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
            canvasCtx.beginPath();
            canvasCtx.arc(x, y, size + 2, 0, Math.PI * 2);
            canvasCtx.stroke();
          };

          const leftIris = landmarks[468];
          const rightIris = landmarks[473];
          drawIrisCrosshair(leftIris);
          drawIrisCrosshair(rightIris);

          // METRICS LOGIC
          if (lastLandmarks.current) {
            let totalDiff = 0;
            const checkIndices = [1, 33, 263, 61, 291]; 
            checkIndices.forEach(idx => {
               const d = Math.sqrt(
                 Math.pow(landmarks[idx].x - lastLandmarks.current[idx].x, 2) +
                 Math.pow(landmarks[idx].y - lastLandmarks.current[idx].y, 2)
               );
               totalDiff += d;
            });
            jitterRef.current = (jitterRef.current * 0.9) + (totalDiff * 0.1);
          }
          lastLandmarks.current = landmarks;

          const faceCenter = landmarks[1];
          const vx = ((leftIris.x + rightIris.x) / 2 - faceCenter.x) * 60; 
          const vy = ((leftIris.y + rightIris.y) / 2 - faceCenter.y) * 60;
          const vz = Math.abs(landmarks[33].z - landmarks[263].z) * 10;
          
          setEyeVector({ x: vx, y: vy, z: vz });

          const isLookingAtLens = Math.abs(leftIris.x - 0.5) < 0.12 && Math.abs(leftIris.y - 0.45) < 0.12;
          setEyeContact(isLookingAtLens);
          setTrackingAccuracy(prev => prev * 0.95 + 0.05 * (1.0 - Math.min(1.0, jitterRef.current * 1000)));
        } else {
          setTrackingAccuracy(0);
        }
        canvasCtx.restore();
      });

      // @ts-ignore
      const camera = new window.Camera(videoRef.current, {
        onFrame: async () => {
          if (faceMeshRef.current && videoRef.current) {
            try {
              await faceMeshRef.current.send({ image: videoRef.current });
            } catch (e) {}
          }
        },
        width: 640,
        height: 480
      });
      cameraRef.current = camera;
      await camera.start();

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.onresult = (event: any) => {
          const result = event.results[event.results.length - 1];
          const text = result[0].transcript.toLowerCase();
          FILLER_WORDS.forEach(word => {
            if (text.includes(word)) {
              setFillerCount(prev => ({ ...prev, [word]: (prev[word] || 0) + 1 }));
              setFlash(true);
              addLog(`Filler word detected: ${word}`);
              setTimeout(() => setFlash(false), 200);
            }
          });
        };
        speechRecognitionRef.current = recognition;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyzer = audioCtx.createAnalyser();
      analyzer.fftSize = 256;
      source.connect(analyzer);

      const bufferLength = analyzer.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!audioContextRef.current) return;
        analyzer.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const v = sum / bufferLength;
        setVolume(v);
        requestAnimationFrame(updateVolume);
      };
      updateVolume();

      addLog("Sensors synchronized. System nominal.");
    } catch (err: any) {
      setPermissionError(err.message || "HARDWARE_FAILURE");
    }
  }, []);

  useEffect(() => {
    initSystem();
    return () => {
      if (cameraRef.current) cameraRef.current.stop();
      if (audioContextRef.current) audioContextRef.current.close();
      if (statsInterval.current) clearInterval(statsInterval.current);
    };
  }, [initSystem]);

  const startSession = useCallback(() => {
    if (permissionError) return;
    setIsRecording(true);
    startTime.current = Date.now();
    setMetricsHistory([]);
    setFillerCount({});
    if (speechRecognitionRef.current) speechRecognitionRef.current.start();
    addLog("Analysis initiated.");

    statsInterval.current = setInterval(() => {
      setMetricsHistory(prev => {
        const stabilityMod = Math.max(0, 100 - (jitterRef.current * 5000) - (eyeContact ? 0 : 15));
        const newStability = (emotionStability * 0.7) + (stabilityMod * 0.3);
        setEmotionStability(newStability);

        if (newStability < 35) {
          lowStabilityCounter.current += 1;
          if (lowStabilityCounter.current >= 3 && !assistantVoiceTriggered.current) {
            triggerAssistantVoice("Take a deep breath. Recalibrating focus.");
            assistantVoiceTriggered.current = true;
          }
        } else {
          lowStabilityCounter.current = 0;
          assistantVoiceTriggered.current = false;
        }

        const newMetric: MetricSnapshot = {
          timestamp: Date.now() - startTime.current,
          confidence: Math.max(10, Math.min(100, (eyeContact ? confidence + 2 : confidence - 3))),
          eyeContact,
          bpm: 72 + Math.floor(Math.random() * 8) + (newStability < 50 ? 15 : 0),
          emotion: newStability > 70 ? "STABLE" : newStability > 40 ? "NERVOUS" : "STRESSED",
          emotionStability: newStability
        };
        setConfidence(newMetric.confidence);
        setBpm(newMetric.bpm);
        return [...prev, newMetric];
      });
    }, 1000);
  }, [eyeContact, confidence, emotionStability, permissionError, triggerAssistantVoice]);

  const stopSession = useCallback(() => {
    setIsRecording(false);
    if (statsInterval.current) clearInterval(statsInterval.current);
    if (speechRecognitionRef.current) speechRecognitionRef.current.stop();

    const data: SessionData = {
      duration: (Date.now() - startTime.current) / 1000,
      fillerWords: fillerCount,
      avgConfidence: metricsHistory.length > 0 ? metricsHistory.reduce((a, b) => a + b.confidence, 0) / metricsHistory.length : 0,
      eyeContactPercentage: metricsHistory.length > 0 ? (metricsHistory.filter(m => m.eyeContact).length / metricsHistory.length) * 100 : 0,
      avgBpm: metricsHistory.length > 0 ? metricsHistory.reduce((a, b) => a + b.bpm, 0) / metricsHistory.length : 0,
      avgEmotionStability: metricsHistory.length > 0 ? metricsHistory.reduce((a, b) => a + b.emotionStability, 0) / metricsHistory.length : 0,
      metricsHistory,
      dominantEmotion: metricsHistory.length > 0 ? metricsHistory[metricsHistory.length - 1].emotion : "CONFIDENT",
      transcript: ""
    };

    onStop(data);
  }, [fillerCount, metricsHistory, onStop]);

  // Heatmap generation logic
  const stabilityHeatmap = useMemo(() => {
    return metricsHistory.map((m, i) => {
      let color = 'bg-[#00ff41]'; // Stable
      if (m.emotionStability < 40) color = 'bg-red-500'; // Stressed
      else if (m.emotionStability < 70) color = 'bg-blue-500'; // Nervous
      return { id: i, color };
    });
  }, [metricsHistory]);

  const Gauge = ({ label, value, colorClass, glowClass, gradientFrom }: { label: string, value: number, colorClass: string, glowClass: string, gradientFrom: string }) => (
    <div className="space-y-2 group">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {label.includes("Stability") ? <Zap size={14} className={`${colorClass} ${value < 50 ? 'animate-pulse' : ''}`} /> : <Activity size={14} className={colorClass} />}
          <span className="text-[10px] font-black uppercase opacity-70 tracking-[0.2em]">{label}</span>
        </div>
        <span className={`text-2xl font-black italic digital-pulse ${colorClass}`}>{Math.round(value)}%</span>
      </div>
      <div className="relative h-4 w-full bg-black/80 border border-white/10 rounded-[2px] overflow-hidden backdrop-blur-md">
        <div 
          className={`h-full bg-gradient-to-r ${gradientFrom} transition-all duration-1000 ease-out relative ${glowClass}`} 
          style={{ width: `${value}%` }}
        />
        <div className="absolute top-0 bottom-0 w-[2px] bg-white transition-all duration-1000 ease-out shadow-[0_0_10px_#fff]" style={{ left: `${value}%` }} />
      </div>
    </div>
  );

  return (
    <div 
      className={`fixed inset-0 bg-transparent flex flex-col p-6 transition-all duration-300 ${flash ? 'bg-red-900/10' : ''}`}
      style={{
        boxShadow: `inset 0 0 ${volume * 1.5}px rgba(0, 255, 65, ${Math.min(0.3, volume / 100)})`,
        border: `${Math.min(4, volume / 20)}px solid rgba(0, 255, 65, ${Math.min(0.2, volume / 200)})`
      }}
    >
      {/* Top Banner */}
      <div className="flex justify-between items-start mb-4 border-b border-[#00ff41]/30 pb-4 shrink-0 tech-flicker">
        <div className="flex flex-col">
          <span className="text-[10px] opacity-50 font-black tracking-[0.3em] uppercase">Operator: T. Panjtan</span>
          <span className="text-2xl font-black tracking-widest text-[#00ff41] drop-shadow-[0_0_10px_rgba(0,255,65,0.4)] uppercase">Zenith_Neural_HUD_v3.2</span>
        </div>
        <div className="flex items-center space-x-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] opacity-40 uppercase font-black tracking-widest">Session Timer</span>
            <span className="text-2xl font-mono text-white tracking-widest drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">
              {isRecording ? ((Date.now() - startTime.current) / 1000).toFixed(1) : "0.0"}<span className="text-[10px] opacity-50 ml-1">SEC</span>
            </span>
          </div>
          {!isRecording ? (
            <button onClick={startSession} className="bg-[#00ff41] text-black px-8 py-2.5 flex items-center space-x-3 font-black tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,255,65,0.5)] border border-[#00ff41]/50">
              <Play size={18} fill="black" /> <span>ENGAGE_NEURAL</span>
            </button>
          ) : (
            <button onClick={stopSession} className="bg-red-600 text-white px-8 py-2.5 flex items-center space-x-3 font-black tracking-widest hover:bg-red-700 transition-colors shadow-[0_0_20px_rgba(255,0,0,0.5)] border border-red-400/50">
              <Square size={18} fill="white" /> <span>TERMINATE</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex justify-between items-center overflow-hidden min-h-0 space-x-6">
        {/* Left Wing */}
        <div className="w-64 flex flex-col h-full space-y-4 shrink-0 overflow-y-auto pr-2 custom-scrollbar text-[#00ff41]">
          <div className="border border-[#00ff41]/20 p-5 hud-border bg-black/60 backdrop-blur-md">
            <div className="flex items-center space-x-2 mb-5 border-b border-[#00ff41]/10 pb-3">
              <MessageSquare size={14} className="opacity-70" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">Vocal Bio-Analysis</span>
            </div>
            <div className="space-y-5">
              {FILLER_WORDS.map(word => (
                <div key={word} className="flex justify-between items-end group border-b border-white/5 pb-1">
                  <span className="text-[9px] uppercase font-bold group-hover:text-white transition-colors tracking-widest opacity-60">{word}</span>
                  <span className={`text-lg font-black leading-none ${fillerCount[word] > 0 ? 'text-red-500 drop-shadow-[0_0_8px_rgba(255,0,0,0.6)]' : 'text-[#00ff41]'}`}>
                    {fillerCount[word] || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 border border-[#00ff41]/20 p-5 hud-border bg-black/60 flex flex-col justify-end overflow-hidden backdrop-blur-md">
             <div className="flex items-end space-x-1.5 h-32">
                {[...Array(20)].map((_, i) => (
                  <div key={i} className="flex-1 bg-[#00ff41]/80 shadow-[0_0_10px_rgba(0,255,65,0.2)]" style={{ height: `${Math.random() * volume * 2}%`, opacity: 0.2 + (i / 30) }} />
                ))}
             </div>
             <span className="text-[8px] text-center mt-3 opacity-40 uppercase tracking-[0.4em] font-black italic">Vocal Frequency Field</span>
          </div>
        </div>

        {/* Center Feed */}
        <div className="flex-1 flex flex-col justify-center items-center relative h-full min-w-0">
          <div className="relative aspect-video h-full w-auto max-w-full rounded-[48px] border-[6px] border-[#00ff41]/30 overflow-hidden hud-border flex items-center justify-center bg-black shadow-[0_0_50px_rgba(0,255,65,0.1)]">
            <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover grayscale brightness-150 contrast-125 opacity-70 blur-[0.5px]" />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10 object-cover" />
            <div className="scanline" />
            
            <div className="absolute top-10 left-1/2 -translate-x-1/2 flex space-x-2 z-20 items-center tech-flicker">
               <div className="w-12 h-[2px] bg-[#00ff41] rounded-full shadow-[0_0_10px_#00ff41]" />
               <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-ping" />
               <div className="w-12 h-[2px] bg-[#00ff41] rounded-full shadow-[0_0_10px_#00ff41]" />
            </div>

            {/* Neural Stress Heatmap Overlay (Timeline) */}
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-[80%] z-20 space-y-2">
              <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-[0.2em] text-[#00ff41]/60">
                <span>Neural_Stability_Heatmap</span>
                <span>Time_Lapse_V_01</span>
              </div>
              <div className="h-2 w-full bg-black/40 backdrop-blur-md rounded-full overflow-hidden flex border border-white/5 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                {stabilityHeatmap.length > 0 ? (
                  stabilityHeatmap.map(seg => (
                    <div key={seg.id} className={`h-full flex-1 ${seg.color} transition-all duration-300 opacity-60`} />
                  ))
                ) : (
                  <div className="w-full h-full bg-white/5 animate-pulse" />
                )}
              </div>
            </div>

            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 text-center w-full px-4">
              <span className={`text-[11px] uppercase font-black tracking-[0.5em] backdrop-blur-md px-6 py-2 border transition-all duration-500 ${eyeContact ? 'text-[#00ff41] border-[#00ff41]/50 bg-[#00ff41]/10 shadow-[0_0_20px_rgba(0,255,65,0.2)]' : 'text-red-500 border-red-500/50 bg-red-500/10 shadow-[0_0_20px_rgba(255,0,0,0.2)]'}`}>
                {eyeContact ? "Iris_Lock_Stable" : "Calibration_Failed"}
              </span>
            </div>
          </div>
        </div>

        {/* Right Wing */}
        <div className="w-80 flex flex-col h-full space-y-4 shrink-0 overflow-y-auto pl-2 custom-scrollbar text-[#00ff41]">
          <div className="border border-[#00ff41]/20 p-6 hud-border bg-black/60 backdrop-blur-md space-y-6">
            <div className="flex items-center justify-between border-b border-[#00ff41]/10 pb-3">
              <div className="flex items-center space-x-3">
                <Target size={18} className="opacity-70" />
                <span className="text-xs font-black uppercase tracking-[0.3em]">Cognitive Analytics</span>
              </div>
              <Activity size={14} className={eyeContact ? 'text-[#00ff41] animate-pulse' : 'text-red-500'} />
            </div>
            
            {/* 3D Gaze Vector Tracker Widget */}
            <div className="flex flex-col items-center justify-center p-5 border border-white/10 bg-black/40 rounded-xl relative overflow-hidden group perspective-1000">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00ff41]/50 to-transparent" />
              <div className="flex items-center space-x-2 mb-4 w-full">
                <Crosshair size={12} className="text-[#00ff41] opacity-50" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60">3D_Gaze_Vector_Spatial</span>
              </div>
              
              <div className="relative w-28 h-28 rounded-full border-2 border-white/5 bg-[#00ff41]/5 flex items-center justify-center shadow-[inset_0_0_30px_rgba(0,255,65,0.05)] transform-gpu hover:rotate-y-12 transition-transform duration-500">
                 <div className="absolute w-full h-[1px] bg-white/10" />
                 <div className="absolute h-full w-[1px] bg-white/10" />
                 <div className="absolute w-3/4 h-3/4 rounded-full border border-white/5" />
                 
                 <div 
                  className="relative transition-all duration-100 ease-out z-20"
                  style={{ 
                    transform: `translate(${eyeVector.x}px, ${eyeVector.y}px) scale(${1 + eyeVector.z * 0.5})`,
                    opacity: eyeContact ? 1 : 0.4
                  }}
                 >
                    <div className="w-4 h-4 rounded-full bg-[#00ff41] shadow-[0_0_20px_#00ff41] animate-pulse flex items-center justify-center">
                       <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    </div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[2px] h-[40px] bg-gradient-to-t from-[#00ff41] to-transparent origin-bottom" 
                         style={{ transform: `rotate(${Math.atan2(eyeVector.y, eyeVector.x) * (180/Math.PI) + 90}deg) scaleY(${Math.sqrt(eyeVector.x**2 + eyeVector.y**2)/20})` }} 
                    />
                 </div>
              </div>
            </div>

            <Gauge 
              label="Confidence Score" 
              value={confidence} 
              colorClass="text-[#00ff41]" 
              glowClass="shadow-[0_0_20px_#00ff41]" 
              gradientFrom="from-green-950 via-[#00ff41] to-emerald-400" 
            />

            <Gauge 
              label="Neural Stability" 
              value={emotionStability} 
              colorClass={emotionStability < 50 ? 'text-red-500' : 'text-cyan-400'} 
              glowClass={emotionStability < 50 ? 'shadow-[0_0_20px_#ef4444]' : 'shadow-[0_0_20px_#22d3ee]'} 
              gradientFrom={emotionStability < 50 ? 'from-red-950 via-red-500 to-orange-500' : 'from-cyan-950 via-cyan-400 to-white'} 
            />

            <div className="flex items-center justify-between pt-6 border-t border-[#00ff41]/10">
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Vocal_BPM_Flux</span>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 italic">Biometric_Trace</span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-4xl font-black text-red-500 animate-pulse drop-shadow-[0_0_15px_rgba(239,68,68,0.8)] italic">
                  {bpm}
                </span>
                <span className="text-[11px] font-black opacity-40 italic uppercase">BPM</span>
              </div>
            </div>
          </div>

          <div className="flex-1 border border-[#00ff41]/20 p-5 hud-border bg-black/60 flex flex-col min-h-0 relative backdrop-blur-md">
            <span className="text-[10px] uppercase font-black opacity-50 mb-5 tracking-[0.3em]">Stability_Variance</span>
            <div className="relative flex-1 w-full min-h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metricsHistory.slice(-100)}>
                  <YAxis domain={[0, 100]} hide />
                  <Line type="stepAfter" dataKey="confidence" stroke="#00ff41" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="emotionStability" stroke="#3b82f6" strokeWidth={1.5} dot={false} isAnimationActive={false} opacity={0.8} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="h-24 mt-4 border-t border-[#00ff41]/20 pt-5 flex space-x-6 shrink-0 text-[#00ff41] bg-black/40 backdrop-blur-lg">
        <div className="w-1/4 flex flex-col justify-center border-r border-[#00ff41]/20 pr-6">
          <span className="text-[9px] opacity-40 uppercase font-black tracking-[0.4em] mb-1.5 italic">System_Diagnostics</span>
          <div className={`flex items-center space-x-3 transition-colors ${emotionStability < 40 ? 'text-red-500' : 'text-white'}`}>
            <AlertTriangle size={20} className={emotionStability < 40 ? 'animate-bounce' : 'opacity-70'} />
            <span className="text-[11px] font-black italic tracking-widest uppercase">
              {emotionStability < 40 ? "Emergency_Protocol_Active" : "Ready_State_Nominal"}
            </span>
          </div>
        </div>
        <div className="flex-1 flex flex-col space-y-1 font-mono text-[9px] opacity-70 overflow-hidden">
          {logs.map((log, i) => (
            <div key={i} className="flex space-x-3 items-center group">
              <span className="text-[#00ff41] font-black">{">>>"}</span>
              <span className="tracking-[0.1em] uppercase group-hover:text-white transition-colors">{log}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
