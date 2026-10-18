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

/** Another user's item offered as a template when adding — without id or owner. */
export type CommunityItem = Pick<
  Item,
  "title" | "artist_creator" | "category" | "subcategory" | "cover_url" | "metadata"
>;

export type ItemUpdate = Partial<Omit<Item, "id" | "user_id" | "created_at">>;

/** What a shared collection's page may show about its owner (RPC `shared_profile`). */
export interface SharedProfile {
  display_name: string | null;
  collection_types: string[] | null;
}

/** Profile of a user (table `profiles`, readable by its owner only). */
export interface Profile {
  id: string;
  display_name: string | null;
  /** Item categories the user keeps in the catalog; null = not chosen yet (asked on first login). */
  collection_types?: string[] | null;
  /** UI language picked by the user ("en" | "pl" | "de"); null = not picked, the device's choice applies. */
  language?: string | null;
  /** Whether the collection is reachable under /share/<id>; false (private) until the user turns it on. */
  share_enabled?: boolean;
}
