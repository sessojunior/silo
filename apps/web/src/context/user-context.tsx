"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { config } from "@/lib/config";
import type { ApiResponse } from "@/lib/api-response";

// === TIPOS ===

interface User {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  emailVerified: boolean;
  image: string;
}

interface UserProfile {
  genre?: string;
  role?: string;
  phone?: string;
  company?: string;
  location?: string;
  team?: string;
}

interface UserPreferences {
  chatEnabled?: boolean;
  showWelcome?: boolean;
}

type PermissionAction = string;
type PermissionResource = string;
type PermissionsSummary = Record<PermissionResource, PermissionAction[]>;

type UserGroupInfo = {
  id: string;
  name: string;
  role: string;
};

interface UserContextType {
  // Estados principais
  user: User | null;
  userProfile: UserProfile | null;
  userPreferences: UserPreferences | null;
  userGroups: UserGroupInfo[];
  permissions: PermissionsSummary;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;

  // Permission helpers
  hasPermission: (resource: string, action: string) => boolean;
  hasAnyPermission: (resource: string, actions: string[]) => boolean;

  // Funções de atualização
  updateUser: (updates: Partial<User>) => void;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
  updateUserPreferences: (updates: Partial<UserPreferences>) => void;
  refreshUser: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  refreshUserPreferences: () => Promise<void>;

  // Funções de sincronização
  syncUserData: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseApiResponse = <T,>(payload: unknown): ApiResponse<T> | null => {
  if (!isRecord(payload)) return null;
  if (typeof payload.success !== "boolean") return null;
  return payload as ApiResponse<T>;
};

type ApiFetchResult<T> = {
  status: number;
  api: ApiResponse<T> | null;
};

const fetchApiResponse = async <T,>(
  path: string,
): Promise<ApiFetchResult<T>> => {
  const response = await fetch(config.getApiUrl(path), {
    credentials: "include",
  });
  const status = response.status;

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return { status, api: parseApiResponse<T>(payload) };
};

// Helpers to canonicalize permissions on the client to the new model (view/manage)
const mapResourceToV2 = (resource: string): string => {
  if (!resource) return resource;
  const r = resource.toLowerCase();
  if (r.startsWith("product") || r.startsWith("picture") || r.startsWith("radar")) return "products";
  if (r.startsWith("project")) return "projects";
  if (r === "groups" || r === "users" || r.startsWith("group")) return "groups";
  if (r === "reports" || r === "dashboard" || r.includes("report")) return "reports";
  if (r === "chat" || r.includes("chat")) return "chat";
  return resource;
};

const mapActionToV2 = (resource: string, action: string): string => {
  if (!action) return "manage";
  const a = action.toLowerCase();
  if (["list", "view", "read"].includes(a) || a.includes("view")) return "view";
  if (["create", "update", "edit", "delete", "assign", "reorder", "approve", "send"].some((x) => a.includes(x))) return "manage";
  return "manage";
};

const canonicalizePermissions = (raw: PermissionsSummary | undefined): PermissionsSummary => {
  const out: PermissionsSummary = {};
  if (!raw) return out;
  Object.entries(raw).forEach(([resource, actions]) => {
    const r2 = mapResourceToV2(resource);
    const set = new Set<string>();
    (actions || []).forEach((a) => {
      if (!a) return;
      // For chat, follow same mapping rules; keep specific chat actions only if they don't map
      const mapped = mapActionToV2(resource, a);
      set.add(mapped);
    });
    if (set.has("manage")) set.add("view");
    out[r2] = Array.from(set);
  });
  return out;
};

// === TIPO PARA DADOS INICIAIS (SERVER-SIDE) ===

export type { UserGroupInfo, PermissionsSummary };

export type InitialUserData = {
  user: User;
  userGroups?: UserGroupInfo[];
  permissions?: PermissionsSummary;
  isAdmin?: boolean;
  userProfile?: UserProfile;
  userPreferences?: UserPreferences;
};

// === PROVIDER ===

export function UserProvider({
  children,
  initialData,
}: {
  children: React.ReactNode;
  initialData?: InitialUserData | null;
}) {
  // Estados principais — usa initialData do servidor se disponível
  const [user, setUser] = useState<User | null>(initialData?.user ?? null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(
    initialData?.userProfile ?? null,
  );
  const [userPreferences, setUserPreferences] =
    useState<UserPreferences | null>(initialData?.userPreferences ?? null);
  const [userGroups, setUserGroups] = useState<UserGroupInfo[]>(
    initialData?.userGroups ?? [],
  );
  const [permissions, setPermissions] = useState<PermissionsSummary>(
    canonicalizePermissions(initialData?.permissions ?? {}),
  );
  const [isAdmin, setIsAdmin] = useState(initialData?.isAdmin ?? false);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  // Rastreia se o usuário já esteve autenticado (para decidir se redireciona no 401)
  const wasAuthenticatedRef = useRef(Boolean(initialData));

  // === REDIRECIONAMENTO AO PERDER AUTENTICAÇÃO ===

  const redirectToLogin = useCallback(() => {
    const loginPath = config.isSmokeMode ? "/login" : config.getPublicPath("/login");
    if (window.location.pathname !== loginPath) {
      window.location.href = loginPath;
    }
  }, []);

  useEffect(() => {
    // Se o usuário estava autenticado (initialData ou user já foi setado)
    // e agora user é null E loading é false, redireciona
    if (!loading && !user && wasAuthenticatedRef.current) {
      redirectToLogin();
    }
  }, [user, loading, redirectToLogin]);

  // === FUNÇÕES DE BUSCA ===

  const fetchUser = useCallback(async (): Promise<User | null> => {
    try {
      const { status, api } = await fetchApiResponse<{
        user: {
          id: string;
          name: string;
          email: string;
          isActive: boolean;
          emailVerified: boolean;
          image?: string | null;
        };
        groups?: UserGroupInfo[];
        permissions?: PermissionsSummary;
        isAdmin?: boolean;
      }>("/api/admin/users/profile");

      if (status === 401) {
        // Sessão expirou ou é inválida — redireciona para login
        setUser(null);
        setUserGroups([]);
        setPermissions({});
        setIsAdmin(false);
        redirectToLogin();
        return null;
      }

      const userFromApi = api?.success ? api.data?.user : null;
      if (!userFromApi) return null;

      const userData: User = {
        id: userFromApi.id,
        name: userFromApi.name,
        email: userFromApi.email,
        isActive: userFromApi.isActive,
        emailVerified: userFromApi.emailVerified,
        image: userFromApi.image || "/images/profile.png",
      };
      setUserGroups(api?.data?.groups ?? []);
      // Normalize permissions to simplified model (view/manage)
      setPermissions(canonicalizePermissions(api?.data?.permissions ?? {}));
      setIsAdmin(api?.data?.isAdmin ?? false);
      wasAuthenticatedRef.current = true;
      return userData;
    } catch (err) {
      console.error("❌ [CONTEXT_USER] Erro ao buscar usuário:", {
        error: err,
      });
    }
    return null;
  }, [redirectToLogin]);

  const fetchUserProfile =
    useCallback(async (): Promise<UserProfile | null> => {
      try {
        const { status, api } = await fetchApiResponse<{
          userProfile: UserProfile;
        }>("/api/admin/users/profile");

        if (status === 401) return null;

        const profileFromApi = api?.success ? api.data?.userProfile : null;
        return profileFromApi ?? null;
      } catch (err) {
        console.error("❌ [CONTEXT_USER] Erro ao buscar perfil:", {
          error: err,
        });
      }
      return null;
    }, []);

  const fetchUserPreferences =
    useCallback(async (): Promise<UserPreferences | null> => {
      try {
        const { status, api } = await fetchApiResponse<{
          userPreferences: UserPreferences;
        }>("/api/admin/users/preferences");

        if (status === 401) return null;

        const preferencesFromApi = api?.success
          ? api.data?.userPreferences
          : null;
        return preferencesFromApi ?? null;
      } catch (err) {
        console.error("❌ [CONTEXT_USER] Erro ao buscar preferências:", {
          error: err,
        });
      }
      return null;
    }, []);

  // === FUNÇÕES DE ATUALIZAÇÃO ===

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  const updateUserProfile = useCallback((updates: Partial<UserProfile>) => {
    setUserProfile((prev) => (prev ? { ...prev, ...updates } : updates));
  }, []);

  const updateUserPreferences = useCallback(
    (updates: Partial<UserPreferences>) => {
      setUserPreferences((prev) => (prev ? { ...prev, ...updates } : updates));

      // Disparar evento customizado para notificar outros componentes
      window.dispatchEvent(
        new CustomEvent("userPreferencesChanged", { detail: updates }),
      );
    },
    [],
  );

  // === FUNÇÕES DE REFRESH ===

  const refreshUser = useCallback(async () => {
    const userData = await fetchUser();
    if (userData) {
      setUser(userData);
    }
  }, [fetchUser]);

  const refreshUserProfile = useCallback(async () => {
    const profileData = await fetchUserProfile();
    if (profileData) {
      setUserProfile(profileData);
    }
  }, [fetchUserProfile]);

  const refreshUserPreferences = useCallback(async () => {
    const preferencesData = await fetchUserPreferences();
    if (preferencesData) {
      setUserPreferences(preferencesData);
    }
  }, [fetchUserPreferences]);

  const syncUserData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [userData, profileData, preferencesData] = await Promise.all([
        fetchUser(),
        fetchUserProfile(),
        fetchUserPreferences(),
      ]);

      if (userData) {
        setUser(userData);
      }
      if (profileData) {
        setUserProfile(profileData);
      }
      if (preferencesData) {
        setUserPreferences(preferencesData);
      }
    } catch (err) {
      console.error("❌ [CONTEXT_USER] Erro na sincronização:", { error: err });
      setError("Erro ao sincronizar dados do usuário");
    } finally {
      setLoading(false);
    }
  }, [fetchUser, fetchUserProfile, fetchUserPreferences]);

  // === INICIALIZAÇÃO ===

  useEffect(() => {
    syncUserData();
  }, [syncUserData]);

  // === LISTENERS PARA EVENTOS CUSTOMIZADOS ===

  useEffect(() => {
    // Listener para mudanças de preferências de chat
    const handleChatPreferenceChange = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const { chatEnabled } = event.detail;
      updateUserPreferences({ chatEnabled });
    };

    // Listener para mudanças de perfil
    const handleProfileChange = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const updates = event.detail;
      updateUserProfile(updates);
    };

    // Listener para mudanças de dados do usuário
    const handleUserChange = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const updates = event.detail;
      updateUser(updates);
    };

    window.addEventListener("chatPreferenceChanged", handleChatPreferenceChange);
    window.addEventListener("userProfileChanged", handleProfileChange);
    window.addEventListener("userDataChanged", handleUserChange);

    return () => {
      window.removeEventListener("chatPreferenceChanged", handleChatPreferenceChange);
      window.removeEventListener("userProfileChanged", handleProfileChange);
      window.removeEventListener("userDataChanged", handleUserChange);
    };
  }, [updateUserPreferences, updateUserProfile, updateUser]);

  // === VALOR DO CONTEXTO ===

  const hasPermissionFn = React.useCallback((resource: string, action: string): boolean => {
    if (isAdmin) return true;
    const r2 = mapResourceToV2(resource);
    const perms = permissions[r2] ?? [];
    const req = mapActionToV2(resource, action);
    if (perms.includes(req)) return true;
    if (req === "view" && perms.includes("manage")) return true;
    return false;
  }, [isAdmin, permissions]);

  const hasAnyPermissionFn = React.useCallback((resource: string, actions: string[]) => {
    return actions.some((a) => hasPermissionFn(resource, a));
  }, [hasPermissionFn]);

  const value: UserContextType = {
    user,
    userProfile,
    userPreferences,
    userGroups,
    permissions,
    isAdmin,
    loading,
    error,
    updateUser,
    updateUserProfile,
    updateUserPreferences,
    refreshUser,
    refreshUserProfile,
    refreshUserPreferences,
    syncUserData,
    hasPermission: hasPermissionFn,
    hasAnyPermission: hasAnyPermissionFn,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

// === HOOKS ===

/**
 * Hook para usar o contexto do usuário
 */
export function useUser(): UserContextType {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser deve ser usado dentro de um UserProvider");
  }
  return context;
}

/**
 * Hook para obter apenas os dados básicos do usuário (compatibilidade com useCurrentUser)
 */
export function useCurrentUser(): {
  currentUser: User | null;
  loading: boolean;
  error: string | null;
} {
  const { user, loading, error } = useUser();
  return { currentUser: user, loading, error };
}

/**
 * Hook para obter apenas o perfil do usuário
 */
export function useUserProfile(): {
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
} {
  const { userProfile, loading, error } = useUser();
  return { userProfile, loading, error };
}

/**
 * Hook para obter apenas as preferências do usuário
 */
export function useUserPreferences(): {
  userPreferences: UserPreferences | null;
  loading: boolean;
  error: string | null;
} {
  const { userPreferences, loading, error } = useUser();
  return { userPreferences, loading, error };
}
