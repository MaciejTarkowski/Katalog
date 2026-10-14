"use client";

import { useEffect, useState, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Item, ItemInsert } from "@/types/database";
import { fetchItems, addItem, deleteItem } from "@/lib/items/api";
import { fetchProfile, updateDisplayName, DISPLAY_NAME_MAX_LENGTH } from "@/lib/profiles/api";
import { AuthForm } from "@/components/auth/AuthForm";
import { ItemList } from "@/components/items/ItemList";
import { AddItemForm } from "@/components/items/AddItemForm";

export function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [displayNameStatus, setDisplayNameStatus] = useState<string | null>(null);

  const supabase = createClient();

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    const { data } = await fetchItems();
    if (data) {
      setItems(data);
    }
    setLoadingItems(false);
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      setUser(currentUser);
      setLoadingAuth(false);
      if (currentUser) {
        loadItems();
      }
    };

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const authUser = session?.user || null;
      setUser(authUser);
      if (authUser) {
        loadItems();
      } else {
        setItems([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadItems, supabase]);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchProfile(userId).then(({ data }) => {
      if (!cancelled) setDisplayName(data?.display_name || "");
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleSaveDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    const { success, error } = await updateDisplayName(displayName);
    setDisplayNameStatus(success ? "Zapisano" : error);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setItems([]);
  };

  const handleAddItem = async (
    item: Omit<ItemInsert, "id" | "user_id" | "created_at" | "updated_at">
  ): Promise<boolean> => {
    const { data, error } = await addItem(item);
    if (error || !data) {
      return false;
    }
    setItems((prev) => [data, ...prev]);
    setIsAddingItem(false);
    return true;
  };

  const handleDeleteItem = async (id: string) => {
    const { success } = await deleteItem(id);
    if (success) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const handleShareCollection = async () => {
    if (!user) return;
    const shareUrl = `${window.location.origin}/share/${user.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 2500);
    } catch {
      // Clipboard fallback
    }
  };

  if (loadingAuth) {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        <p className="text-xs text-slate-400">Ładowanie profilu...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-6 w-full max-w-sm">
        <AuthForm onSuccess={() => loadItems()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-col gap-6 w-full max-w-md self-center">
        {/* User bar */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="min-w-0 pr-2">
            <p className="text-[11px] text-slate-400">Zalogowano jako:</p>
            <p className="text-xs font-semibold text-slate-200 truncate">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-xs text-slate-400 hover:text-rose-400 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 transition-colors"
          >
            Wyloguj
          </button>
        </div>

        {/* Display name shown on the shared collection */}
        <form
          onSubmit={handleSaveDisplayName}
          className="flex flex-col gap-1.5 p-3.5 rounded-2xl bg-slate-900 border border-slate-800"
        >
          <label htmlFor="display-name" className="text-[11px] text-slate-400">
            Nazwa wyświetlana
          </label>
          <div className="flex gap-2">
            <input
              id="display-name"
              type="text"
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setDisplayNameStatus(null);
              }}
              placeholder="Widoczna w udostępnionej kolekcji"
              className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              aria-label="Zapisz nazwę"
              className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 transition-colors"
            >
              Zapisz
            </button>
          </div>
          {displayNameStatus && (
            <p role="status" className="text-[11px] text-slate-400">
              {displayNameStatus}
            </p>
          )}
        </form>

        {/* Action buttons: Dodaj + Udostępnij */}
        <div className="flex flex-col gap-2.5">
          {!isAddingItem ? (
            <button
              type="button"
              onClick={() => setIsAddingItem(true)}
              className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium text-sm transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2"
            >
              <span>+ Dodaj przedmiot</span>
            </button>
          ) : (
            <AddItemForm
              onSubmit={handleAddItem}
              onCancel={() => setIsAddingItem(false)}
            />
          )}

          <button
            type="button"
            onClick={handleShareCollection}
            className="w-full py-2.5 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 text-slate-300 hover:text-white font-medium text-xs transition-all flex items-center justify-center gap-2"
          >
            <span>{copiedShareLink ? "✓ Skopiowano link do schowka!" : "🔗 Udostępnij moją kolekcję"}</span>
          </button>
        </div>
      </div>

      {/* Items List */}
      <ItemList
        items={items}
        isLoading={loadingItems}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        onDeleteItem={handleDeleteItem}
      />
    </div>
  );
}
