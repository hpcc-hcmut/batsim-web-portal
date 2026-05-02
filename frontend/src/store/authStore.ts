import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authAPI, User, LoginCredentials, RegisterData } from "../services/api";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (
    credentials: LoginCredentials
  ) => Promise<{ success: boolean; error?: string }>;
  register: (
    userData: RegisterData
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authAPI.login(credentials);
          const { access_token } = response.data;

          // Set token in store first so the request interceptor picks it up for getMe.
          set({ token: access_token });

          const userResponse = await authAPI.getMe();
          const user = userResponse.data;

          set({
            user,
            token: access_token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          return { success: true };
        } catch (error: any) {
          const errorMessage = error.response?.data?.detail || "Login failed";
          set({
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
          });
          return { success: false, error: errorMessage };
        }
      },

      register: async (userData: RegisterData) => {
        set({ isLoading: true, error: null });
        try {
          await authAPI.register(userData);
          set({ isLoading: false, error: null });
          return { success: true };
        } catch (error: any) {
          const errorMessage =
            error.response?.data?.detail || "Registration failed";
          set({
            isLoading: false,
            error: errorMessage,
          });
          return { success: false, error: errorMessage };
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
        // Belt-and-suspenders: drop legacy raw keys + the persist blob in case
        // version-skewed state is left behind from older builds.
        try {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          localStorage.removeItem("auth-storage");
        } catch {
          // ignore storage errors (private mode etc.)
        }
      },

      checkAuth: async () => {
        const { token } = get();
        if (!token) {
          set({ isAuthenticated: false, user: null, isLoading: false });
          return;
        }
        set({ isLoading: true });
        try {
          const userResponse = await authAPI.getMe();
          set({
            user: userResponse.data,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          // token invalid/expired — clear all auth state
          get().logout();
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;
