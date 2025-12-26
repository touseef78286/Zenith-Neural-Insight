
export enum AnalysisState {
  BOOT = 'BOOT',
  READY = 'READY',
  ANALYZING = 'ANALYZING',
  REPORT = 'REPORT'
}

export interface MetricSnapshot {
  timestamp: number;
  confidence: number;
  eyeContact: boolean;
  bpm: number;
  emotion: string;
  emotionStability: number;
}

export interface SessionData {
  duration: number;
  fillerWords: Record<string, number>;
  avgConfidence: number;
  eyeContactPercentage: number;
  avgBpm: number;
  avgEmotionStability: number;
  metricsHistory: MetricSnapshot[];
  dominantEmotion: string;
  transcript: string;
}

export interface Point {
  x: number;
  y: number;
}