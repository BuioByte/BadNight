export interface EntityReference {
  id: string;
  name: string;
}

export interface GameView {
  ok: true;
  room: { id: string; name: string; description: string };
  objects: EntityReference[];
  ghosts: EntityReference[];
  exits: { to: string; name: string; description: string; open: boolean }[];
  inventory: EntityReference[];
  progress: { visited: number; total: number };
  won?: true;
}

export interface CreateGameResponse {
  sessionId: string;
  title: string;
  intro: string;
  state: GameView;
}

export interface TurnRequest {
  action: string;
  thinking?: string;
}

export interface TurnResponse {
  text: string;
  state: GameView;
}

export interface ErrorResponse {
  error: string;
}

export interface StoryMessage {
  role: 'player' | 'narrator';
  text: string;
  thinking?: string;
}
