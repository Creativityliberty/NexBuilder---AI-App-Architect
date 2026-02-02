
export type ViewMode = 'home' | 'planner' | 'builder' | 'preview' | 'settings' | 'history';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  dependencies: string[]; // IDs of tasks that must complete first
  agentRole: 'architect' | 'developer' | 'reviewer' | 'planner';
  output?: string;
  artifactType?: 'code' | 'text' | 'json';
}

export interface ProjectFile {
  path: string;
  content: string;
  language: string;
}

export interface ActivityLogEntry {
  id: string;
  taskId: string;
  taskTitle: string;
  timestamp: number;
  status: 'started' | 'completed' | 'failed' | 'split';
  details?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  tasks: Task[];
  files: ProjectFile[];
  packages: string[]; // List of npm packages (e.g. 'framer-motion', 'lodash')
  activityLog: ActivityLogEntry[];
  createdAt: number;
}

export type AIProvider = 'google' | 'openrouter';

export interface AppConfig {
  provider: AIProvider;
  openRouterKey: string;
  googleKey?: string;
  model: string; // e.g., 'gemini-3-flash-preview' or 'anthropic/claude-3-5-sonnet'
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
}
