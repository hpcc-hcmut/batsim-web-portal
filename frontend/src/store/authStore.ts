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

          // Store token in localStorage first
          localStorage.setItem("token", access_token);

          // Get user info
          const userResponse = await authAPI.getMe();
          const user = userResponse.data;

          set({
            user,
            token: access_token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          // Store user in localStorage
          localStorage.setItem("user", JSON.stringify(user));

          return { success: true };
        } catch (error: any) {
          const errorMessage = error.response?.data?.detail || "Login failed";
          set({
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
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },

      checkAuth: async () => {
        const token = localStorage.getItem("token");
        const userStr = localStorage.getItem("user");

        if (token && userStr) {
          try {
            const user = JSON.parse(userStr) as User;
            const userResponse = await authAPI.getMe();
            set({
              user: userResponse.data,
              token,
              isAuthenticated: true,
              isLoading: false,
            });
          } catch {
            get().logout();
          }
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
