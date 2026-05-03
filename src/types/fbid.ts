export type FBId = {
  id: string;
  user_id: string;
  uid: string;
  password: string | null;
  pinned: boolean;
  visited: boolean;
  note: string | null;
  tag: string | null;
  visited_at: string | null;
  created_at: string;
  real_name?: string | null;
  username?: string | null;
  photo_url?: string | null;
  follower_count?: string | null;
  nationality?: string | null;
  instagram_username?: string | null;
  profile_fetched_at?: string | null;
};

export const TAGS = ["VIP", "Hot", "New", "Done", "Skip"] as const;
export type Tag = typeof TAGS[number];

export const TAG_COLORS: Record<Tag, string> = {
  VIP: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  Hot: "bg-red-500/20 text-red-300 border-red-500/40",
  New: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  Done: "bg-green-500/20 text-green-300 border-green-500/40",
  Skip: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40",
};