export type FBId = {
  id: string;
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
  friend_count?: string | null;
  nationality?: string | null;
  instagram_username?: string | null;
  profile_fetched_at?: string | null;
  instagram_checking?: boolean;
  instagram_rate_limited?: boolean;
  instagram_checked_at?: string | null;
  fetch_status?: "pending" | "retrying" | "done" | "failed" | "rate_limited" | null;
  fetch_attempts?: number;
  instagram_verify_status?: "success" | "failed" | "rate_limited" | null;
  instagram_verify_reason?: string | null;
};

export const TAGS = ["VIP", "Hot", "New", "Done", "Skip"] as const;
export type Tag = typeof TAGS[number];

export const TAG_COLORS: Record<Tag, string> = {
  VIP: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Hot:  "bg-rose-500/15 text-rose-400 border-rose-500/30",
  New:  "bg-blue-500/15 text-blue-400 border-blue-500/30",
  Done: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Skip: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};
