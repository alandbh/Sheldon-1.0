import { Project } from "./projects-data";

export interface AuthUser {
  email: string;
  name?: string;
  photoURL?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  timestamp: number;
  isThinking?: boolean;
  script?: string;       // Stores the generated Python code
  pythonOutput?: string; // Stores the stdout/stderr from execution
}

export interface AppState {
  hasApiKey: boolean;
  isPythonReady: boolean;
  activeTab: 'home' | 'chat' | 'admin';
  selectedProject: Project | null;
  isLoadingData: boolean;
  
  // Data Content
  heuristicasContent: any | null;
  resultadosContent: any | null;
  heuristicasFile: File | null; // Kept for legacy admin upload
}

export enum ProcessingStep {
  IDLE = 'IDLE',
  GENERATING_SCRIPT = 'Writing analysis script...',
  EXECUTING_PYTHON = 'Analyzing data (Python Runtime)...',
  GENERATING_RESPONSE = 'Formatting insights...',
  DONE = 'DONE'
}

// Minimal shape for heuristics file validation
export interface HeuristicFile {
  heuristics: Record<string, any>;
  journeys: any[];
}
