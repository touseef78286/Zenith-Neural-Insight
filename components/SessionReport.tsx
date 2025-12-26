
import React, { useState, useEffect, useMemo } from 'react';
import { Download, Share2, RefreshCcw, TrendingUp, Mic, Eye, Loader2, Zap, Activity, Award } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { SessionData } from '../types';
import html2canvas from 'html2canvas';

interface SessionReportProps {
  data: SessionData;
  onReset: () => void;
}

export const SessionReport: React.FC<SessionReportProps> = ({ data, onReset }) => {
  const [aiAnalysis, setAiAnalysis] = useState<string>("Analyzing your session patterns...");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Analyze this public speaking session and provide a brief professional advice:
          - Eye Contact: ${data.eyeContactPercentage.toFixed(1)}%
          - Avg Confidence: ${data.avgConfidence.toFixed(1)}%
          - Emotion Stability: ${data.avgEmotionStability.toFixed(1)}%
          - Filler Words: ${JSON.stringify(data.fillerWords)}
          - Avg BPM: ${data.avgBpm.toFixed(0)}
          
          Provide a 3-sentence professional critique focusing on confidence and emotional presence. Include one specific recommendation based on the stability score.`,
          config: {
            temperature: 0.7,
            topP: 1,
            topK: 1
          }
        });
        setAiAnalysis(response.text || "Exceptional performance. Maintain your current pace.");
      } catch (err) {
        setAiAnalysis("Analysis system offline. Your metrics speak for themselves.");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [data]);

  const handleExport = async () => {
    const element = document.getElementById('report-card');
    if (!element) return;
    
    setExporting(true);
    try {
      // Small delay to ensure any layout shifts are settled
      await new Promise(r => setTimeout(r, 100));
      
      const canvas = await html2canvas(element, {
        backgroundColor: '#0a0a0a',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
      });
      
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `Zenith_Neural_Insight_Report_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  const getRank = () => {
    if (data.avgConfidence > 80 && data.eyeContactPercentage > 85 && data.avgEmotionStability > 80) return "ZENITH MASTER";
    if (data.avgConfidence > 50) return "PROFESSIONAL";
    return "INITIATE";
  };

  const getRankColor = () => {
    const rank = getRank();
    if (rank === "ZENITH MASTER") return "text-[#00ff41]";
    if (rank === "PROFESSIONAL") return "text-blue-400";
    return "text-yellow-500";
  };

  const totalFillers = (Object.values(data.fillerWords) as number[]).reduce((a, b) => (a as number) + (b as number), 0);

  const heatmapSegments = useMemo(() => {
    if (!data.metricsHistory || data.metricsHistory.length === 0) return [];
    
    const segmentCount = Math.min(60, data.metricsHistory.length);
    const result = [];
    const chunkSize = Math.ceil(data.metricsHistory.length / segmentCount);
    
    for (let i = 0; i < segmentCount; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, data.metricsHistory.length);
      const chunk = data.metricsHistory.slice(start, end);
      const avgStability = chunk.reduce((sum, m) => sum + m.emotionStability, 0) / chunk.length;
      
      let color = 'bg-[#00ff41]'; 
      if (avgStability < 40) color = 'bg-red-500'; 
      else if (avgStability < 70) color = 'bg-blue-500'; 
      
      result.push({ color, stability: avgStability });
    }
    return result;
  }, [data.metricsHistory]);

  return (
    <div className="flex flex-col items-center justify-center min-h-full w-full p-8 animate-in fade-in duration-700 bg-transparent">
      <div id="report-card" className="w-full max-w-4xl bg-[#0a0a0a] border border-[#00ff41]/30 p-12 hud-border relative overflow-hidden shadow-2xl">
        {/* Background circuit patterns and glitches for export aesthetic */}
        <div className="absolute top-0 right-0 p-4 opacity-20 font-mono text-[8px] pointer-events-none">
          [METRIC_VERIFIED: {Math.random().toString(36).substring(7).toUpperCase()}]
        </div>
        <div className="absolute -bottom-10 -right-10 w-60 h-60 border border-[#00ff41]/5 rounded-full pointer-events-none" />
        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00ff41]/5 to-transparent pointer-events-none" />

        {/* Watermark Logo requested in the corner */}
        <div className="absolute bottom-6 right-6 flex flex-col items-end pointer-events-none opacity-40">
           <div className="flex items-center space-x-2">
              <span className="text-[10px] font-black tracking-[0.2em] text-[#00ff41]">OREWA_ZENITH</span>
              <div className="w-1.5 h-1.5 bg-[#00ff41] rounded-full" />
           </div>
           <span className="text-[7px] font-bold uppercase tracking-[0.4em] mt-1 text-white">Powered by Zenith Neural-AI</span>
        </div>

        <div className="flex flex-col space-y-10 relative z-10">
          <div className="border-b border-[#00ff41]/20 pb-8 flex justify-between items-start">
            <div className="space-y-2">
              <h2 className="text-[10px] tracking-[0.6em] opacity-50 uppercase font-black text-[#00ff41]">Neural Performance Summary</h2>
              <h1 className={`text-7xl font-black italic tracking-tighter glitch-text ${getRankColor()}`}>
                {getRank()}
              </h1>
            </div>
            <div className="text-right flex flex-col items-end">
              <Award className={`mb-2 ${getRankColor()}`} size={32} />
              <span className="text-[9px] opacity-40 font-black tracking-widest uppercase mb-1">Session Integrity</span>
              <div className="text-2xl font-black tracking-widest">{data.avgEmotionStability > 70 ? 'STABLE_AXIS' : 'DIVERGENT'}</div>
            </div>
          </div>

          {/* Core Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-3 bg-white/5 p-4 border border-white/5 rounded-sm">
              <div className="flex items-center space-x-2 opacity-50">
                <Eye size={14} className="text-[#00ff41]" />
                <span className="text-[9px] uppercase font-black tracking-widest">Iris Focus</span>
              </div>
              <div className="text-3xl font-black text-white">{data.eyeContactPercentage.toFixed(1)}%</div>
              <div className="h-1 bg-white/10 overflow-hidden rounded-full">
                <div className="h-full bg-[#00ff41] shadow-[0_0_10px_#00ff41]" style={{ width: `${data.eyeContactPercentage}%` }} />
              </div>
            </div>

            <div className="space-y-3 bg-white/5 p-4 border border-white/5 rounded-sm">
              <div className="flex items-center space-x-2 opacity-50">
                <Activity size={14} className="text-blue-400" />
                <span className="text-[9px] uppercase font-black tracking-widest">Neural Stability</span>
              </div>
              <div className="text-3xl font-black text-white">{data.avgEmotionStability.toFixed(1)}%</div>
              <div className="h-1 bg-white/10 overflow-hidden rounded-full">
                <div className="h-full bg-blue-500 shadow-[0_0_10px_#3b82f6]" style={{ width: `${data.avgEmotionStability}%` }} />
              </div>
            </div>

            <div className="space-y-3 bg-white/5 p-4 border border-white/5 rounded-sm">
              <div className="flex items-center space-x-2 opacity-50">
                <TrendingUp size={14} className="text-[#00ff41]" />
                <span className="text-[9px] uppercase font-black tracking-widest">Projected Conf.</span>
              </div>
              <div className="text-3xl font-black text-white">{data.avgConfidence.toFixed(1)}%</div>
              <div className="h-1 bg-white/10 overflow-hidden rounded-full">
                <div className="h-full bg-[#00ff41] shadow-[0_0_10px_#00ff41]" style={{ width: `${data.avgConfidence}%` }} />
              </div>
            </div>

            <div className="space-y-3 bg-white/5 p-4 border border-white/5 rounded-sm">
              <div className="flex items-center space-x-2 opacity-50">
                <Mic size={14} className="text-red-500" />
                <span className="text-[9px] uppercase font-black tracking-widest">Vocal Fillers</span>
              </div>
              <div className="text-3xl font-black text-white">{totalFillers}</div>
              <div className="text-[8px] opacity-40 uppercase font-black tracking-widest truncate">
                 {Object.keys(data.fillerWords).slice(0, 3).join(' / ') || 'CLEAN_SIGNAL'}
              </div>
            </div>
          </div>

          {/* Neural Stress Mapping (Heatmap) */}
          <div className="space-y-4 bg-white/[0.02] p-6 border border-white/5">
             <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                   <Activity size={16} className="text-[#00ff41] opacity-70" />
                   <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/80">Biological Flux Tracking (Session Timeline)</h3>
                </div>
                <div className="flex space-x-5 text-[7px] font-black uppercase tracking-widest">
                   <div className="flex items-center space-x-1.5"><span className="w-1.5 h-1.5 bg-[#00ff41] rounded-full shadow-[0_0_5px_#00ff41]" /> <span>Zenith</span></div>
                   <div className="flex items-center space-x-1.5"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_5px_#3b82f6]" /> <span>Stable</span></div>
                   <div className="flex items-center space-x-1.5"><span className="w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_5px_#ef4444]" /> <span>Alert</span></div>
                </div>
             </div>
             <div className="flex h-14 w-full gap-[2px] bg-black p-1.5 rounded-sm border border-white/5 overflow-hidden">
                {heatmapSegments.map((seg, i) => (
                   <div 
                      key={i} 
                      className={`flex-1 ${seg.color} transition-all duration-300 opacity-70 hover:opacity-100 hover:scale-y-110 cursor-pointer`}
                      style={{ filter: 'brightness(1.2)' }}
                   />
                ))}
             </div>
             <div className="flex justify-between text-[8px] opacity-30 font-black tracking-[0.3em] uppercase italic">
                <span>Start: 0.0s [INIT]</span>
                <span>Duration: {data.duration.toFixed(1)}s [LOG_END]</span>
             </div>
          </div>

          {/* AI Advice Section */}
          <div className="bg-[#00ff41]/5 p-8 border-l-[6px] border-[#00ff41] relative group overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#00ff41]/5 -mr-16 -mt-16 rounded-full blur-3xl" />
            <Zap size={24} className="absolute -top-3 -left-3 text-[#00ff41] bg-[#0a0a0a] rounded-full p-1.5 border border-[#00ff41]/40" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] mb-4 text-[#00ff41]">Neural Core Synthesis Advice</h3>
            <div className="text-base leading-relaxed italic opacity-90 font-medium text-white/90">
              {loading ? (
                <span className="flex items-center space-x-3">
                  <Loader2 size={16} className="animate-spin text-[#00ff41]" />
                  <span className="tracking-widest text-xs uppercase opacity-60">Syncing cognitive patterns via Gemini core...</span>
                </span>
              ) : `"${aiAnalysis}"`}
            </div>
          </div>

          {/* Footer Branding for the card itself */}
          <div className="flex justify-between items-center pt-10 border-t border-white/10 opacity-60">
             <div className="flex items-center space-x-3">
               <div className="w-8 h-8 rounded-sm border-2 border-[#00ff41]/40 flex items-center justify-center font-black text-[#00ff41] text-[10px] italic">
                 ZN
               </div>
               <div>
                 <div className="text-[9px] font-black uppercase tracking-widest text-white">Zenith Behavioral Engine</div>
                 <div className="text-[7px] opacity-70 tracking-[0.1em] uppercase">Architecture by Touseef Panjtan</div>
               </div>
             </div>
             <div className="text-[7px] font-black uppercase tracking-[0.5em] text-white/40">
                © 2025 ZENITH NEURAL-INSIGHT // ALL_RIGHTS_RESERVED
             </div>
          </div>
        </div>
      </div>

      <div className="mt-12 flex flex-col items-center space-y-6">
        <div className="flex space-x-4">
           <button 
            onClick={handleExport}
            disabled={exporting}
            className="group relative flex items-center space-x-3 bg-[#00ff41] text-black px-10 py-4 font-black tracking-[0.2em] uppercase text-sm hover:scale-105 transition-all shadow-[0_0_30px_rgba(0,255,65,0.4)] disabled:opacity-50 disabled:cursor-not-allowed border-2 border-[#00ff41]"
           >
             {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
             <span>{exporting ? "SYNTHESIZING..." : "EXPORT IMAGE"}</span>
             <div className="absolute -inset-1 bg-white/20 blur opacity-0 group-hover:opacity-100 transition-opacity" />
           </button>

           <button className="flex items-center space-x-3 border-2 border-[#00ff41]/30 text-[#00ff41] px-10 py-4 font-black tracking-[0.2em] uppercase text-sm hover:bg-[#00ff41]/10 transition-all">
             <Share2 size={18} />
             <span>SHARE_NODE</span>
           </button>
        </div>

        <button 
          onClick={onReset}
          className="flex items-center space-x-3 text-white/40 hover:text-[#00ff41] transition-all hover:scale-105 group"
        >
          <RefreshCcw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.5em]">Re-Initiate Neural Diagnostics</span>
        </button>
      </div>
    </div>
  );
};
