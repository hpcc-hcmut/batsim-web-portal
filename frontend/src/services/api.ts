import axios, { AxiosResponse } from "axios";

const API_BASE_URL = "http://localhost:8000/api";

// Types
export type UserRole = "admin" | "pi" | "researcher" | "student";

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  is_active: string;
  created_at: string;
  updated_at?: string;
}

export type ProjectRole = "owner" | "member" | "viewer";

export interface ProjectMember {
  id: number;
  project_id: number;
  user_id: number;
  role: ProjectRole;
  created_at: string;
  username?: string;
  email?: string;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  owner_id: number;
  created_at: string;
  updated_at?: string;
  owner_username?: string;
  member_count?: number;
  workload_count?: number;
  platform_count?: number;
  scenario_count?: number;
  strategy_count?: number;
  experiment_count?: number;
  members?: ProjectMember[];
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
  // Versioning (FR3)
  version?: number;
  parent_id?: number;
  tags?: string; // JSON array of strings
  // Project association (FR2)
  project_id?: number;
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
  // Versioning (FR3)
  version?: number;
  parent_id?: number;
  topology_type?: string;
  // Project association (FR2)
  project_id?: number;
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
  // Scenario config (FR4)
  config?: string; // JSON string for scenario-specific parameters
  // Versioning (FR3)
  parent_scenario_id?: number;
  // Project association (FR2)
  project_id?: number;
  // Prediction configuration (Phase 7)
  prediction_enabled?: boolean;
  prediction_model_id?: number;
  prediction_mode?: PredictionMode;
}

// Prediction types (Phase 7)
export type PredictionMode = "no_prediction" | "prediction_only" | "hybrid";
export type ModelType = "xgboost" | "random_forest" | "linear" | "mock";

export interface PredictionModel {
  id: number;
  name: string;
  description?: string;
  model_path: string;
  model_type: ModelType;
  is_active: boolean;
  accuracy?: number;
  mae?: number;
  features?: string;
  created_at: string;
  updated_at?: string;
  created_by?: number;
}

export interface JobPredictionSample {
  job_id: string;
  original_walltime: number;
  predicted_duration: number;
  confidence: number;
  mode: string;
}

export interface PredictionPreviewResponse {
  total_jobs: number;
  sample_size: number;
  mode: string;
  model_id?: number;
  samples: JobPredictionSample[];
}

export interface PredictionStats {
  total_models: number;
  active_models: number;
  available_modes: string[];
}

export type StrategyType =
  | "fcfs"
  | "backfilling"
  | "easy_backfill"
  | "priority"
  | "fair_share"
  | "energy_aware"
  | "rl_based"
  | "custom";

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
  // Strategy classification (FR6)
  strategy_type?: StrategyType;
  // Versioning (FR3)
  version?: number;
  parent_id?: number;
  is_baseline?: boolean;
  // Project association (FR2)
  project_id?: number;
}

export type ExperimentStatus =
  | "created"
  | "queued"
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export interface Experiment {
  id: number;
  name: string;
  description?: string;
  scenario_id: number;
  strategy_id: number;
  status: ExperimentStatus;
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
  // Project association (FR2)
  project_id?: number;
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
  role?: UserRole;
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

// Projects API (FR2)
export const projectsAPI = {
  getAll: (params?: {
    skip?: number;
    limit?: number;
  }): Promise<AxiosResponse<Project[]>> => api.get("/projects", { params }),
  getById: (id: number): Promise<AxiosResponse<Project>> =>
    api.get(`/projects/${id}`),
  create: (data: {
    name: string;
    description?: string;
  }): Promise<AxiosResponse<Project>> => api.post("/projects", data),
  update: (
    id: number,
    data: { name?: string; description?: string }
  ): Promise<AxiosResponse<Project>> => api.put(`/projects/${id}`, data),
  delete: (id: number): Promise<AxiosResponse<void>> =>
    api.delete(`/projects/${id}`),
  // Member management
  getMembers: (projectId: number): Promise<AxiosResponse<ProjectMember[]>> =>
    api.get(`/projects/${projectId}/members`),
  addMember: (
    projectId: number,
    data: { user_id: number; role: ProjectRole }
  ): Promise<AxiosResponse<ProjectMember>> =>
    api.post(`/projects/${projectId}/members`, data),
  removeMember: (projectId: number, userId: number): Promise<AxiosResponse<void>> =>
    api.delete(`/projects/${projectId}/members/${userId}`),
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
  exportCSV: (params?: { start_date?: string; end_date?: string }): Promise<AxiosResponse<Blob>> =>
    api.get("/results/export/csv", { params, responseType: "blob" }),
  exportJSON: (params?: { start_date?: string; end_date?: string }): Promise<AxiosResponse<Blob>> =>
    api.get("/results/export/json", { params, responseType: "blob" }),
  exportResultCSV: (id: number): Promise<AxiosResponse<Blob>> =>
    api.get(`/results/${id}/export/csv`, { responseType: "blob" }),
};

// System API
export const systemAPI = {
  getStatus: (): Promise<AxiosResponse<{ message: string }>> =>
    api.get("/system"),
  getResources: (): Promise<
    AxiosResponse<{ cpu: number; memory: number; disk: number }>
  > => api.get("/system/resources"),
};



// Grafana API
export interface GrafanaStatus {
  available: boolean;
  url: string;
  embed_enabled: boolean;
}

export interface GrafanaDashboard {
  uid: string;
  title: string;
  url: string;
  embed_url: string;
}

export interface GrafanaPredefinedDashboard {
  uid: string;
  title: string;
  description: string;
  embed_url: string;
  panels: Array<{ id: number; title: string }>;
}

export const grafanaAPI = {
  getStatus: (): Promise<AxiosResponse<GrafanaStatus>> =>
    api.get("/grafana/status"),
  getDashboards: (): Promise<AxiosResponse<{ dashboards: any[] }>> =>
    api.get("/grafana/dashboards"),
  getDashboard: (uid: string): Promise<AxiosResponse<any>> =>
    api.get(`/grafana/dashboards/${uid}`),
  createDashboard: (data: {
    experiment_id: number;
    experiment_name: string;
    container_name?: string;
  }): Promise<AxiosResponse<GrafanaDashboard>> =>
    api.post("/grafana/dashboards", data),
  deleteDashboard: (uid: string): Promise<AxiosResponse<{ status: string; uid: string }>> =>
    api.delete(`/grafana/dashboards/${uid}`),
  getEmbedUrl: (
    uid: string,
    panelId?: number
  ): Promise<AxiosResponse<{ uid: string; embed_url: string; full_url: string }>> =>
    api.get(`/grafana/embed-url/${uid}`, { params: panelId ? { panel_id: panelId } : {} }),
  getPredefinedDashboards: (): Promise<
    AxiosResponse<{ dashboards: GrafanaPredefinedDashboard[] }>
  > => api.get("/grafana/predefined-dashboards"),
};

// Predictions API (Phase 7)
export const predictionsAPI = {
  getModels: (activeOnly?: boolean): Promise<AxiosResponse<PredictionModel[]>> =>
    api.get("/predictions/models", { params: { active_only: activeOnly ?? true } }),
  getModel: (id: number): Promise<AxiosResponse<PredictionModel>> =>
    api.get(`/predictions/models/${id}`),
  createModel: (data: {
    name: string;
    description?: string;
    model_path: string;
    model_type?: string;
    features?: string;
  }): Promise<AxiosResponse<PredictionModel>> =>
    api.post("/predictions/models", data),
  updateModel: (
    id: number,
    data: { name?: string; description?: string; is_active?: boolean }
  ): Promise<AxiosResponse<PredictionModel>> =>
    api.put(`/predictions/models/${id}`, data),
  deleteModel: (id: number): Promise<AxiosResponse<void>> =>
    api.delete(`/predictions/models/${id}`),
  preview: (data: {
    workload_id: number;
    model_id?: number;
    mode: string;
    sample_size?: number;
  }): Promise<AxiosResponse<PredictionPreviewResponse>> =>
    api.post("/predictions/preview", data),
  getStats: (): Promise<AxiosResponse<PredictionStats>> =>
    api.get("/predictions/stats"),
  uploadModelFile: (modelId: number, file: File): Promise<AxiosResponse<{ message: string; path: string }>> => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(`/predictions/models/${modelId}/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// --- Audit Logging Types (Phase 8) ---
export interface AuditLog {
  id: number;
  user_id: number;
  action: string;
  entity_type: string;
  entity_id: number;
  entity_name?: string;
  project_id?: number;
  changes?: Record<string, { old: unknown; new: unknown }>;
  created_at: string;
  username?: string;
  ip_address?: string;
}

export interface AuditLogListResponse {
  items: AuditLog[];
  total: number;
  next_cursor?: string;
}

// --- Comment Types (Phase 8) ---
export interface Comment {
  id: number;
  content: string;
  entity_type: string;
  entity_id: number;
  parent_id?: number;
  thread_level: number;
  user_id: number;
  username?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at?: string;
  reply_count: number;
  replies?: Comment[];
}

// Audit API (Phase 8)
export const auditAPI = {
  getLogs: (params?: {
    entity_type?: string;
    entity_id?: number;
    user_id?: number;
    project_id?: number;
    limit?: number;
    cursor?: string;
  }): Promise<AxiosResponse<AuditLogListResponse>> =>
    api.get("/audit", { params }),

  getEntityHistory: (
    entityType: string,
    entityId: number,
    limit?: number
  ): Promise<AxiosResponse<AuditLog[]>> =>
    api.get(`/audit/entity/${entityType}/${entityId}`, { params: { limit } }),
};

// Comments API (Phase 8)
export const commentsAPI = {
  getComments: (
    entityType: string,
    entityId: number,
    includeDeleted?: boolean
  ): Promise<AxiosResponse<Comment[]>> =>
    api.get("/comments", {
      params: { entity_type: entityType, entity_id: entityId, include_deleted: includeDeleted },
    }),

  getThreaded: (
    entityType: string,
    entityId: number
  ): Promise<AxiosResponse<Comment[]>> =>
    api.get("/comments/threaded", {
      params: { entity_type: entityType, entity_id: entityId },
    }),

  create: (data: {
    entity_type: string;
    entity_id: number;
    content: string;
    parent_id?: number;
  }): Promise<AxiosResponse<Comment>> =>
    api.post("/comments", data),

  update: (id: number, content: string): Promise<AxiosResponse<Comment>> =>
    api.put(`/comments/${id}`, { content }),

  delete: (id: number): Promise<AxiosResponse<void>> =>
    api.delete(`/comments/${id}`),
};

export default api;
