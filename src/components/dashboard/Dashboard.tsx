"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Item } from "@/types/database";
import { fetchItems, addItem, deleteItem } from "@/lib/items/api";
import { fetchProfile } from "@/lib/profiles/api";
import { initialOf } from "@/lib/items/display";
import { Welcome } from "@/components/auth/Welcome";
import { ItemDetailView } from "@/components/items/ItemDetailView";
import { HomeScreen } from "@/components/app/HomeScreen";
import { SearchScreen } from "@/components/app/SearchScreen";
import { AddScreen, type NewItem } from "@/components/app/AddScreen";
import { ShareScreen } from "@/components/app/ShareScreen";
import { ProfileScreen } from "@/components/app/ProfileScreen";
import { TabBar, type Tab } from "@/components/app/TabBar";
import { Toast } from "@/components/ui/primitives";

export function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [tab, setTab] = useState<Tab>("home");
  const [detail, setDetail] = useState<Item | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // One client per mount, so the auth effect below does not re-run on every render.
  const [supabase] = useState(createClient);

  const showToast = useCallback((message: string) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

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

  // Each screen starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab, detail]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setItems([]);
    setTab("home");
    setDetail(null);
  };

  const handleAddItem = async (item: NewItem): Promise<boolean> => {
    const { data, error } = await addItem(item);
    if (error || !data) {
      return false;
    }
    setItems((prev) => [data, ...prev]);
    return true;
  };

  const handleDeleteItem = async (item: Item) => {
    const { success } = await deleteItem(item.id);
    if (success) {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setDetail(null);
      showToast(`Usunięto „${item.title}”`);
    }
  };

  const selectTab = (next: Tab) => {
    setDetail(null);
    setTab(next);
  };

  if (loadingAuth) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-ac border-t-transparent animate-spin" />
        <p className="text-xs text-mu">Ładowanie profilu...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Welcome onAuthSuccess={showToast} />
        <Toast message={toast} />
      </>
    );
  }

  const name = displayName || user.email?.split("@")[0] || "";

  return (
    <div className="relative w-full max-w-[480px] mx-auto min-h-dvh">
      {detail ? (
        <ItemDetailView
          key={detail.id}
          item={detail}
          onBack={() => setDetail(null)}
          onDelete={handleDeleteItem}
          similar={items.filter((i) => i.category === detail.category && i.id !== detail.id)}
          onOpen={setDetail}
        />
      ) : tab === "home" ? (
        <HomeScreen
          items={items}
          isLoading={loadingItems}
          userInitial={initialOf(name) || "K"}
          onOpen={setDetail}
          onProfile={() => selectTab("profile")}
          onAdd={() => selectTab("add")}
        />
      ) : tab === "search" ? (
        <SearchScreen items={items} onOpen={setDetail} />
      ) : tab === "add" ? (
        <AddScreen onAdd={handleAddItem} onToast={showToast} />
      ) : tab === "share" ? (
        <ShareScreen userId={user.id} name={name} items={items} onToast={showToast} />
      ) : (
        <ProfileScreen
          name={displayName}
          items={items}
          onOpen={setDetail}
          onNameSaved={setDisplayName}
          onSignOut={handleSignOut}
          onToast={showToast}
        />
      )}

      <TabBar active={tab} onSelect={selectTab} />
      <Toast message={toast} />
    </div>
  );
}
