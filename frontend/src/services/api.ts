import axios, { AxiosResponse } from "axios";

const API_BASE_URL = "http://localhost:8000/api";

// Types
export interface User {
  id: number;
  username: string;
  email: string;
  role: "admin" | "user";
  is_active: string;
  created_at: string;
  updated_at?: string;
}

export interface Workload {
  id: number;
  name: string;
  description?: string;
  file_path: string;
  file_size?: number;
  file_type?: string;
  created_by?: number;
  created_at: string;
  updated_at?: string;
  creator_username?: string;
  nb_res?: number;
  jobs?: string; // JSON string
  profiles?: string; // JSON string
}

export interface Platform {
  id: number;
  name: string;
  description?: string;
  file_path: string;
  file_size?: number;
  file_type?: string;
  created_by?: number;
  created_at: string;
  updated_at?: string;
  creator_username?: string;
  nb_hosts?: number;
  nb_clusters?: number;
  platform_config?: string; // XML string
}

export interface Scenario {
  id: number;
  name: string;
  description?: string;
  workload_id: number;
  platform_id: number;
  created_by?: number;
  created_at: string;
  updated_at?: string;
  workload_name?: string;
  platform_name?: string;
  creator_username?: string;
}

export interface Strategy {
  id: number;
  name: string;
  description?: string;
  file_path: string;
  file_size?: number;
  file_type: string;
  created_by?: number;
  created_at: string;
  updated_at?: string;
  creator_username?: string;
  nb_files?: number;
  main_entry?: string;
  strategy_files?: string; // JSON string
}

export interface Experiment {
  id: number;
  name: string;
  description?: string;
  scenario_id: number;
  strategy_id: number;
  status:
    | "pending"
    | "running"
    | "paused"
    | "completed"
    | "failed"
    | "cancelled";
  batsim_container_id?: string;
  pybatsim_container_id?: string;
  start_time?: string;
  end_time?: string;
  estimated_duration?: number;
  total_jobs?: number;
  completed_jobs: number;
  progress_percentage: number;
  config?: string;
  simulation_dir?: string;
  batsim_logs?: string;
  pybatsim_logs?: string;
  created_by?: number;
  created_at: string;
  updated_at?: string;
  scenario_name?: string;
  strategy_name?: string;
  creator_username?: string;
}

export interface Result {
  id: number;
  experiment_id: number;
  simulation_time?: number;
  total_jobs?: number;
  completed_jobs?: number;
  failed_jobs: number;
  makespan?: number;
  average_waiting_time?: number;
  average_turnaround_time?: number;
  resource_utilization?: number;
  config?: string;
  metrics?: string;
  logs?: string;
  result_file_path?: string;
  log_file_path?: string;
  created_at: string;
  experiment_name?: string;
  scenario_name?: string;
  strategy_name?: string;
  jobs_data?: string; // CSV string
  schedule_data?: string; // CSV string
  computed_metrics?: string; // JSON string
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  role?: "admin" | "user";
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (
    credentials: LoginCredentials
  ): Promise<AxiosResponse<TokenResponse>> => {
    // Use JSON endpoint for easier frontend integration
    return api.post("/auth/login-json", credentials);
  },
  register: (userData: RegisterData): Promise<AxiosResponse<User>> =>
    api.post("/auth/register", userData),
  getMe: (): Promise<AxiosResponse<User>> => api.get("/auth/me"),
};

// Workloads API
export const workloadsAPI = {
  getAll: (params?: {
    skip?: number;
    limit?: number;
  }): Promise<AxiosResponse<Workload[]>> => api.get("/workloads", { params }),
  getById: (id: number): Promise<AxiosResponse<Workload>> =>
    api.get(`/workloads/${id}`),
  create: (formData: FormData): Promise<AxiosResponse<Workload>> =>
    api.post("/workloads", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  update: (
    id: number,
    data: Partial<Workload>
  ): Promise<AxiosResponse<Workload>> => api.put(`/workloads/${id}`, data),
  delete: (id: number): Promise<AxiosResponse<{ message: string }>> =>
    api.delete(`/workloads/${id}`),
  download: (
    id: number
  ): Promise<AxiosResponse<{ file_path: string; file_name: string }>> =>
    api.get(`/workloads/${id}/download`),
};

// Platforms API
export const platformsAPI = {
  getAll: (params?: {
    skip?: number;
    limit?: number;
  }): Promise<AxiosResponse<Platform[]>> => api.get("/platforms", { params }),
  getById: (id: number): Promise<AxiosResponse<Platform>> =>
    api.get(`/platforms/${id}`),
  create: (formData: FormData): Promise<AxiosResponse<Platform>> =>
    api.post("/platforms", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  update: (
    id: number,
    data: Partial<Platform>
  ): Promise<AxiosResponse<Platform>> => api.put(`/platforms/${id}`, data),
  updateFile: (
    id: number,
    formData: FormData
  ): Promise<AxiosResponse<Platform>> =>
    api.put(`/platforms/${id}/file`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  delete: (id: number): Promise<AxiosResponse<{ message: string }>> =>
    api.delete(`/platforms/${id}`),
  download: (
    id: number
  ): Promise<AxiosResponse<{ file_path: string; file_name: string }>> =>
    api.get(`/platforms/${id}/download`),
};

// Scenarios API
export const scenariosAPI = {
  getAll: (params?: {
    skip?: number;
    limit?: number;
  }): Promise<AxiosResponse<Scenario[]>> => api.get("/scenarios", { params }),
  getById: (id: number): Promise<AxiosResponse<Scenario>> =>
    api.get(`/scenarios/${id}`),
  create: (
    data: Omit<Scenario, "id" | "created_at" | "updated_at">
  ): Promise<AxiosResponse<Scenario>> => api.post("/scenarios", data),
  update: (
    id: number,
    data: Partial<Scenario>
  ): Promise<AxiosResponse<Scenario>> => api.put(`/scenarios/${id}`, data),
  delete: (id: number): Promise<AxiosResponse<{ message: string }>> =>
    api.delete(`/scenarios/${id}`),
};

// Strategies API
export const strategiesAPI = {
  getAll: (params?: {
    skip?: number;
    limit?: number;
  }): Promise<AxiosResponse<Strategy[]>> => api.get("/strategies", { params }),
  getById: (id: number): Promise<AxiosResponse<Strategy>> =>
    api.get(`/strategies/${id}`),
  create: (formData: FormData): Promise<AxiosResponse<Strategy>> =>
    api.post("/strategies", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  update: (
    id: number,
    data: Partial<Strategy>
  ): Promise<AxiosResponse<Strategy>> => api.put(`/strategies/${id}`, data),
  updateFile: (
    id: number,
    formData: FormData
  ): Promise<AxiosResponse<Strategy>> =>
    api.put(`/strategies/${id}/file`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  delete: (id: number): Promise<AxiosResponse<{ message: string }>> =>
    api.delete(`/strategies/${id}`),
  download: (
    id: number
  ): Promise<AxiosResponse<{ file_path: string; file_name: string }>> =>
    api.get(`/strategies/${id}/download`),
};

// Experiments API
export const experimentsAPI = {
  getAll: (params?: {
    skip?: number;
    limit?: number;
  }): Promise<AxiosResponse<Experiment[]>> =>
    api.get("/experiments", { params }),
  getById: (id: number): Promise<AxiosResponse<Experiment>> =>
    api.get(`/experiments/${id}`),
  create: (data: {
    name: string;
    description?: string;
    scenario_id: number;
    strategy_id: number;
    config?: any;
  }): Promise<AxiosResponse<Experiment>> => api.post("/experiments", data),
  update: (
    id: number,
    data: Partial<Experiment>
  ): Promise<AxiosResponse<Experiment>> => api.put(`/experiments/${id}`, data),
  delete: (id: number): Promise<AxiosResponse<{ message: string }>> =>
    api.delete(`/experiments/${id}`),
  start: (id: number): Promise<AxiosResponse<{ message: string }>> =>
    api.post(`/experiments/${id}/start`),
  stop: (id: number): Promise<AxiosResponse<{ message: string }>> =>
    api.post(`/experiments/${id}/stop`),
  getStatus: (
    id: number
  ): Promise<
    AxiosResponse<{
      status: string;
      progress_percentage: number;
      completed_jobs: number;
      total_jobs: number;
      start_time: string;
      end_time: string;
    }>
  > => api.get(`/experiments/${id}/status`),
};

// Results API
export const resultsAPI = {
  getAll: (params?: {
    skip?: number;
    limit?: number;
  }): Promise<AxiosResponse<Result[]>> => api.get("/results", { params }),
  getById: (id: number): Promise<AxiosResponse<Result>> =>
    api.get(`/results/${id}`),
  getByExperiment: (experimentId: number): Promise<AxiosResponse<Result[]>> =>
    api.get(`/results/experiment/${experimentId}`),
  getAnalytics: (params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<AxiosResponse<any>> => api.get("/results/analytics", { params }),
  delete: (id: number): Promise<AxiosResponse<{ message: string }>> =>
    api.delete(`/results/${id}`),
};

// System API
export const systemAPI = {
  getStatus: (): Promise<AxiosResponse<{ message: string }>> =>
    api.get("/system"),
  getResources: (): Promise<
    AxiosResponse<{ cpu: number; memory: number; disk: number }>
  > => api.get("/system/resources"),
};

export default api;
