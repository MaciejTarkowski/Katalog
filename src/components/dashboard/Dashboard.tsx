"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Item } from "@/types/database";
import { fetchItems, addItem, deleteItem, updateItemMetadata } from "@/lib/items/api";
import {
  ensureProfile,
  nameFromMetadata,
  updateCollectionTypes,
  updateLanguage,
  updateShareEnabled,
} from "@/lib/profiles/api";
import { CATEGORIES, filterByTypes, initialOf, visibleCategories } from "@/lib/items/display";
import { Welcome } from "@/components/auth/Welcome";
import { ItemDetailView } from "@/components/items/ItemDetailView";
import { HomeScreen } from "@/components/app/HomeScreen";
import { SearchScreen } from "@/components/app/SearchScreen";
import { AddScreen, type NewItem } from "@/components/app/AddScreen";
import { ShareScreen } from "@/components/app/ShareScreen";
import { ProfileScreen } from "@/components/app/ProfileScreen";
import { TabBar, type Tab } from "@/components/app/TabBar";
import { CollectionTypesPicker } from "@/components/app/CollectionTypesPicker";
import { Toast } from "@/components/ui/primitives";
import { setLocale, useI18n } from "@/lib/i18n/locale";
import { isLocale, type Locale } from "@/lib/i18n/config";

export function Dashboard() {
  const { t } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [displayName, setDisplayName] = useState("");
  // Item categories the user keeps: undefined = unknown (show all), null = not chosen yet (ask).
  const [types, setTypes] = useState<string[] | null | undefined>(undefined);
  const [sharing, setSharing] = useState(false);
  const [editingTypes, setEditingTypes] = useState(false);
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
  const metadataName = nameFromMetadata(user?.user_metadata);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    ensureProfile(userId, metadataName).then(({ data }) => {
      if (cancelled) return;
      setDisplayName(data?.display_name || "");
      setTypes(data?.collection_types);
      setSharing(data?.share_enabled === true);
      // The language saved in the profile follows the user to every device.
      if (isLocale(data?.language)) setLocale(data.language);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, metadataName]);

  // Each screen starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab, detail]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setItems([]);
    setTypes(undefined);
    setSharing(false);
    setEditingTypes(false);
    setTab("home");
    setDetail(null);
  };

  const handleLanguageChange = (locale: Locale) => {
    setLocale(locale);
    void updateLanguage(locale);
  };

  /** Returns null on success, or the error message to show the user. */
  const handleSaveTypes = async (next: string[]): Promise<string | null> => {
    const { success, error } = await updateCollectionTypes(next);
    if (!success) return error || t("types.saveFailed");
    setTypes(next);
    setEditingTypes(false);
    return null;
  };

  /** Returns null on success, or the error message to show the user. */
  const handleSharingChange = async (enabled: boolean): Promise<string | null> => {
    const { success, error } = await updateShareEnabled(enabled);
    if (!success) return error || t("share.error.save");
    setSharing(enabled);
    return null;
  };

  /** Returns null on success, or the error message to show the user. */
  const handleAddItem = async (item: NewItem): Promise<string | null> => {
    const { data, error } = await addItem(item);
    if (error || !data) {
      return error || t("dashboard.saveFailed");
    }
    setItems((prev) => [data, ...prev]);
    return null;
  };

  const handleDeleteItem = async (item: Item) => {
    const { success } = await deleteItem(item.id);
    if (success) {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setDetail(null);
      showToast(t("dashboard.deleted", { title: item.title }));
    }
  };

  // A description looked up in the detail view: keep it in the list and save it for next time.
  const handleItemChange = (updated: Item) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setDetail((prev) => (prev?.id === updated.id ? updated : prev));
    void updateItemMetadata(updated.id, updated.metadata);
  };

  const selectTab = (next: Tab) => {
    setDetail(null);
    setTab(next);
  };

  if (loadingAuth) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-ac border-t-transparent animate-spin" />
        <p className="text-xs text-mu">{t("dashboard.loadingProfile")}</p>
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

  if (types === null || editingTypes) {
    if (loadingItems) {
      return (
        <div className="flex items-center justify-center min-h-dvh">
          <div className="w-8 h-8 rounded-full border-2 border-ac border-t-transparent animate-spin" />
        </div>
      );
    }
    const firstChoice = types === null;
    // First login: preselect what is already in the collection.
    const initial =
      types ??
      CATEGORIES.map((c) => c.value as string).filter((v) => !firstChoice || items.some((i) => i.category === v));
    return (
      <>
        <CollectionTypesPicker
          initial={initial}
          onSave={handleSaveTypes}
          onCancel={firstChoice ? undefined : () => setEditingTypes(false)}
        />
        <Toast message={toast} />
      </>
    );
  }

  // Items of unchosen types stay in the database, they are only hidden.
  const shownItems = filterByTypes(items, types);
  const categories = visibleCategories(types, t);

  return (
    <div className="relative w-full max-w-[480px] mx-auto min-h-dvh">
      {detail ? (
        <ItemDetailView
          key={detail.id}
          item={detail}
          onBack={() => setDetail(null)}
          onDelete={handleDeleteItem}
          similar={shownItems.filter((i) => i.category === detail.category && i.id !== detail.id)}
          onOpen={setDetail}
          onItemChange={handleItemChange}
        />
      ) : tab === "home" ? (
        <HomeScreen
          items={shownItems}
          isLoading={loadingItems}
          userInitial={initialOf(name) || "K"}
          onOpen={setDetail}
          onProfile={() => selectTab("profile")}
          onAdd={() => selectTab("add")}
        />
      ) : tab === "search" ? (
        <SearchScreen items={shownItems} categories={categories} onOpen={setDetail} />
      ) : tab === "add" ? (
        <AddScreen categories={categories} onAdd={handleAddItem} onToast={showToast} />
      ) : tab === "share" ? (
        <ShareScreen
          userId={user.id}
          name={name}
          items={shownItems}
          sharing={sharing}
          onSharingChange={handleSharingChange}
          onToast={showToast}
        />
      ) : (
        <ProfileScreen
          name={displayName}
          items={shownItems}
          categories={categories}
          onOpen={setDetail}
          onNameSaved={setDisplayName}
          onSignOut={handleSignOut}
          onEditTypes={() => setEditingTypes(true)}
          onLanguageChange={handleLanguageChange}
          onToast={showToast}
        />
      )}

      <TabBar active={tab} onSelect={selectTab} />
      <Toast message={toast} />
    </div>
  );
}
