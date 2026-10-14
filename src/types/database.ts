export interface Item {
  id: string;
  user_id: string;
  title: string;
  artist_creator: string | null;
  category: string;
  subcategory: string | null;
  cover_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

export type ItemInsert = Omit<Item, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type ItemUpdate = Partial<Omit<Item, "id" | "user_id" | "created_at">>;

/** Public profile (table `profiles`) — the name shown on a shared collection. */
export interface Profile {
  id: string;
  display_name: string | null;
}
