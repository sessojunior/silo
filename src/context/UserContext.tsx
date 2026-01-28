"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
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

const fetchApiResponse = async <T,>(path: string): Promise<ApiFetchResult<T>> => {
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

// === PROVIDER ===

export function UserProvider({ children }: { children: React.ReactNode }) {
  // Estados principais
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userPreferences, setUserPreferences] =
    useState<UserPreferences | null>(null);
  const [userGroups, setUserGroups] = useState<UserGroupInfo[]>([]);
  const [permissions, setPermissions] = useState<PermissionsSummary>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      }>("/api/user-profile");

      if (status === 401) return null;

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
      setPermissions(api?.data?.permissions ?? {});
      setIsAdmin(api?.data?.isAdmin ?? false);
      return userData;
    } catch (err) {
      console.error("❌ [CONTEXT_USER] Erro ao buscar usuário:", {
        error: err,
      });
    }
    return null;
  }, []);

  const fetchUserProfile =
    useCallback(async (): Promise<UserProfile | null> => {
      try {
        const { status, api } = await fetchApiResponse<{
          userProfile: UserProfile;
        }>("/api/user-profile");

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
        }>("/api/user-preferences");

        if (status === 401) return null;

        const preferencesFromApi = api?.success ? api.data?.userPreferences : null;
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
    const handleChatPreferenceChange = (event: CustomEvent) => {
      const { chatEnabled } = event.detail;
      updateUserPreferences({ chatEnabled });
    };

    // Listener para mudanças de perfil
    const handleProfileChange = (event: CustomEvent) => {
      const updates = event.detail;
      updateUserProfile(updates);
    };

    // Listener para mudanças de dados do usuário
    const handleUserChange = (event: CustomEvent) => {
      const updates = event.detail;
      updateUser(updates);
    };

    window.addEventListener(
      "chatPreferenceChanged",
      handleChatPreferenceChange as EventListener,
    );
    window.addEventListener(
      "userProfileChanged",
      handleProfileChange as EventListener,
    );
    window.addEventListener(
      "userDataChanged",
      handleUserChange as EventListener,
    );

    return () => {
      window.removeEventListener(
        "chatPreferenceChanged",
        handleChatPreferenceChange as EventListener,
      );
      window.removeEventListener(
        "userProfileChanged",
        handleProfileChange as EventListener,
      );
      window.removeEventListener(
        "userDataChanged",
        handleUserChange as EventListener,
      );
    };
  }, [updateUserPreferences, updateUserProfile, updateUser]);

  // === VALOR DO CONTEXTO ===

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
