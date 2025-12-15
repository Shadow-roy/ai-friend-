export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: Date;
  isThinking?: boolean;
}

export enum AppMode {
  VOICE_CALL = 'VOICE_CALL',
  TEXT_CHAT = 'TEXT_CHAT'
}

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

// Visualizer types
export interface VisualizerData {
  volume: number;
}
