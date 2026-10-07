// FROZEN CONTRACT — reaction threads. HTTP: /api/threads/[episodeId] GET -> {comments: Comment[], reactions: ReactionCounts}
// POST {body, gif?, spoiler, author, reaction?} -> Comment ; POST /api/report {commentId, reason} -> {ok:true}
export const REACTIONS = ["love", "lol", "shocked", "sad", "angry", "bored"] as const;
export type Reaction = (typeof REACTIONS)[number];
export type ReactionCounts = Record<Reaction, number>;
export interface Comment {
  id: string; episodeId: string; author: string; authorId: string; body: string;
  gif?: { url: string; width: number; height: number; provider: string };
  spoiler: boolean; createdAt: number; hidden?: boolean; reports?: number;
}
export interface NewComment { body: string; author: string; authorId: string; spoiler: boolean; gif?: Comment["gif"]; }
export interface ThreadStore {
  list(episodeId: string): Promise<Comment[]>;
  add(episodeId: string, c: NewComment): Promise<Comment>;
  react(episodeId: string, r: Reaction, authorId: string): Promise<ReactionCounts>;
  reactions(episodeId: string): Promise<ReactionCounts>;
  report(commentId: string, reason: string, reporterId: string): Promise<{ hidden: boolean }>;
}
