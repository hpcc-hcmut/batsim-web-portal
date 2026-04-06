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

export interface Campaign {
  id: number;
  name: string;
  description?: string;
  notes?: string;
  status: string;
  matrix_definition_json?: string;
  created_by?: number;
  created_at: string;
  updated_at?: string;
  total_runs?: number;
  completed_runs?: number;
  failed_runs?: number;
  running_runs?: number;
  pending_runs?: number;
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
    | "preparing"
    | "running"
    | "parsing"
    | "completed"
    | "failed"
    | "cancelled"
    | "queued";
  run_uuid?: string;
  seed?: number;
  parameter_json?: string;
  execution_backend?: string;
  batsim_version?: string;
  scheduler_version?: string;
  strategy_commit_hash?: string;
  platform_checksum?: string;
  workload_checksum?: string;
  start_time?: string;
  end_time?: string;
  estimated_duration?: number;
  total_jobs?: number;
  completed_jobs: number;
  progress_percentage: number;
  config?: string;
  status_detail?: string;
  failure_reason?: string;
  simulation_dir?: string;
  manifest_path?: string;
  stdout_log_path?: string;
  stderr_log_path?: string;
  batsim_stdout_log_path?: string;
  batsim_stderr_log_path?: string;
  scheduler_stdout_log_path?: string;
  scheduler_stderr_log_path?: string;
  exit_code?: number;
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
  metric_json?: string;
  summary_json?: string;
  logs?: string;
  result_file_path?: string;
  log_file_path?: string;
  jobs_csv_path?: string;
  schedule_csv_path?: string;
  raw_output_dir?: string;
  created_at: string;
  ingested_at?: string;
  parser_version?: string;
  metric_version?: string;
  parsing_warnings?: string;
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

export interface ExperimentLogs {
  batsim_stdout?: string | null;
  batsim_stderr?: string | null;
  scheduler_stdout?: string | null;
  scheduler_stderr?: string | null;
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

export const campaignsAPI = {
  getAll: (): Promise<AxiosResponse<Campaign[]>> => api.get("/campaigns"),
  getById: (id: number): Promise<AxiosResponse<Campaign>> =>
    api.get(`/campaigns/${id}`),
  create: (data: {
    name: string;
    description?: string;
    notes?: string;
    scenario_ids: number[];
    strategy_ids: number[];
    seeds: number[];
    parameter_variants?: Record<string, any>[];
  }): Promise<AxiosResponse<Campaign>> => api.post("/campaigns", data),
  getExperiments: (id: number): Promise<AxiosResponse<Experiment[]>> =>
    api.get(`/campaigns/${id}/experiments`),
  start: (id: number): Promise<AxiosResponse<{ message: string }>> =>
    api.post(`/campaigns/${id}/start`),
  stop: (id: number): Promise<AxiosResponse<{ message: string }>> =>
    api.post(`/campaigns/${id}/stop`),
  retryFailed: (
    id: number
  ): Promise<AxiosResponse<{ message: string; retried: number }>> =>
    api.post(`/campaigns/${id}/retry-failed`),
  exportBundle: (id: number): Promise<AxiosResponse<Blob>> =>
    api.get(`/campaigns/${id}/export`, { responseType: "blob" }),
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
  clone: (id: number): Promise<AxiosResponse<Experiment>> =>
    api.post(`/experiments/${id}/clone`),
  rerun: (id: number): Promise<AxiosResponse<Experiment>> =>
    api.post(`/experiments/${id}/rerun`),
  getLogs: (id: number): Promise<AxiosResponse<ExperimentLogs>> =>
    api.get(`/experiments/${id}/logs`),
  getManifest: (id: number): Promise<AxiosResponse<Record<string, any>>> =>
    api.get(`/experiments/${id}/manifest`),
  downloadArtifacts: (id: number): Promise<AxiosResponse<Blob>> =>
    api.get(`/experiments/${id}/artifacts`, { responseType: "blob" }),
  getStatus: (
    id: number
  ): Promise<
    AxiosResponse<{
      status: string;
      status_detail?: string;
      failure_reason?: string;
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
  getByExperiment: (experimentId: number): Promise<AxiosResponse<Result>> =>
    api.get(`/results/by-experiment/${experimentId}`),
  getAnalytics: (params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<AxiosResponse<any>> => api.get("/results/analytics", { params }),
  ingest: (experimentId: number): Promise<AxiosResponse<Result>> =>
    api.post(`/results/ingest/${experimentId}`),
  exportBundle: (resultId: number): Promise<AxiosResponse<Blob>> =>
    api.get(`/results/${resultId}/export`, { responseType: "blob" }),
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

export const downloadBlob = (blob: Blob, filename: string) => {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(href);
};
