// Mock Data for BatSim Web Portal Demo UI
// This file contains realistic mock data for demonstration purposes

export interface MockWorkload {
  id: number;
  name: string;
  description: string;
  file_path: string;
  file_size: number;
  file_type: string;
  created_at: string;
  creator_username: string;
  nb_res: number;
  jobs_count: number;
}

export interface MockPlatform {
  id: number;
  name: string;
  description: string;
  file_path: string;
  file_size: number;
  file_type: string;
  created_at: string;
  creator_username: string;
  nb_hosts: number;
  nb_clusters: number;
}

export interface MockScenario {
  id: number;
  name: string;
  description: string;
  workload_id: number;
  platform_id: number;
  workload_name: string;
  platform_name: string;
  created_at: string;
  creator_username: string;
}

export interface MockStrategy {
  id: number;
  name: string;
  description: string;
  file_path: string;
  file_size: number;
  file_type: string;
  created_at: string;
  creator_username: string;
  main_entry: string;
}

export interface MockExperiment {
  id: number;
  name: string;
  description: string;
  scenario_id: number;
  strategy_id: number;
  scenario_name: string;
  strategy_name: string;
  status: "pending" | "running" | "paused" | "completed" | "failed" | "cancelled";
  progress_percentage: number;
  completed_jobs: number;
  total_jobs: number;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  creator_username: string;
}

export interface MockResult {
  id: number;
  experiment_id: number;
  experiment_name: string;
  scenario_name: string;
  strategy_name: string;
  simulation_time: number;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  makespan: number;
  average_waiting_time: number;
  average_turnaround_time: number;
  resource_utilization: number;
  created_at: string;
}

// Mock Workloads
export const mockWorkloads: MockWorkload[] = [
  {
    id: 1,
    name: "HPC Scientific Workload",
    description: "Large-scale scientific computation jobs with varying resource requirements",
    file_path: "/workloads/hpc_scientific.json",
    file_size: 245000,
    file_type: "application/json",
    created_at: "2024-12-01T10:00:00Z",
    creator_username: "admin",
    nb_res: 128,
    jobs_count: 1000,
  },
  {
    id: 2,
    name: "Web Traffic Simulation",
    description: "Simulated web server request patterns with burst traffic",
    file_path: "/workloads/web_traffic.json",
    file_size: 128000,
    file_type: "application/json",
    created_at: "2024-12-02T14:30:00Z",
    creator_username: "researcher_02",
    nb_res: 64,
    jobs_count: 5000,
  },
  {
    id: 3,
    name: "Machine Learning Training",
    description: "GPU-intensive ML model training jobs",
    file_path: "/workloads/ml_training.json",
    file_size: 512000,
    file_type: "application/json",
    created_at: "2024-12-03T09:15:00Z",
    creator_username: "researcher_01",
    nb_res: 256,
    jobs_count: 200,
  },
  {
    id: 4,
    name: "Batch Processing Tasks",
    description: "ETL and data processing batch jobs",
    file_path: "/workloads/batch_processing.json",
    file_size: 89000,
    file_type: "application/json",
    created_at: "2024-12-04T11:45:00Z",
    creator_username: "admin",
    nb_res: 32,
    jobs_count: 800,
  },
  {
    id: 5,
    name: "Real-time Analytics",
    description: "Stream processing and real-time analytics workload",
    file_path: "/workloads/realtime_analytics.json",
    file_size: 156000,
    file_type: "application/json",
    created_at: "2024-12-05T16:20:00Z",
    creator_username: "researcher_01",
    nb_res: 48,
    jobs_count: 3000,
  },
];

// Mock Platforms
export const mockPlatforms: MockPlatform[] = [
  {
    id: 1,
    name: "Cluster-128",
    description: "128-node HPC cluster with InfiniBand interconnect",
    file_path: "/platforms/cluster128.xml",
    file_size: 45000,
    file_type: "application/xml",
    created_at: "2024-11-15T08:00:00Z",
    creator_username: "admin",
    nb_hosts: 128,
    nb_clusters: 4,
  },
  {
    id: 2,
    name: "Cloud-Hybrid",
    description: "Hybrid cloud platform with on-demand scaling capabilities",
    file_path: "/platforms/cloud_hybrid.xml",
    file_size: 67000,
    file_type: "application/xml",
    created_at: "2024-11-18T12:30:00Z",
    creator_username: "researcher_02",
    nb_hosts: 256,
    nb_clusters: 8,
  },
  {
    id: 3,
    name: "GPU-Cluster-64",
    description: "64-node GPU cluster for ML workloads",
    file_path: "/platforms/gpu_cluster.xml",
    file_size: 38000,
    file_type: "application/xml",
    created_at: "2024-11-20T10:15:00Z",
    creator_username: "admin",
    nb_hosts: 64,
    nb_clusters: 2,
  },
  {
    id: 4,
    name: "Edge-Network",
    description: "Distributed edge computing network",
    file_path: "/platforms/edge_network.xml",
    file_size: 89000,
    file_type: "application/xml",
    created_at: "2024-11-22T14:45:00Z",
    creator_username: "researcher_01",
    nb_hosts: 512,
    nb_clusters: 16,
  },
];

// Mock Scenarios
export const mockScenarios: MockScenario[] = [
  {
    id: 1,
    name: "HPC Batch Processing",
    description: "High-performance computing scenario with batch job scheduling",
    workload_id: 1,
    platform_id: 1,
    workload_name: "HPC Scientific Workload",
    platform_name: "Cluster-128",
    created_at: "2024-12-01T10:00:00Z",
    creator_username: "admin",
  },
  {
    id: 2,
    name: "Cloud Burst Test",
    description: "Testing cloud burst capabilities with sudden load increases",
    workload_id: 2,
    platform_id: 2,
    workload_name: "Web Traffic Simulation",
    platform_name: "Cloud-Hybrid",
    created_at: "2024-12-02T14:30:00Z",
    creator_username: "researcher_02",
  },
  {
    id: 3,
    name: "ML Training Pipeline",
    description: "Machine learning model training with GPU acceleration",
    workload_id: 3,
    platform_id: 3,
    workload_name: "Machine Learning Training",
    platform_name: "GPU-Cluster-64",
    created_at: "2024-12-03T09:15:00Z",
    creator_username: "researcher_01",
  },
  {
    id: 4,
    name: "Edge Computing Analysis",
    description: "Distributed processing across edge network",
    workload_id: 5,
    platform_id: 4,
    workload_name: "Real-time Analytics",
    platform_name: "Edge-Network",
    created_at: "2024-12-04T11:45:00Z",
    creator_username: "researcher_03",
  },
  {
    id: 5,
    name: "Energy Efficiency Study",
    description: "Analyzing energy consumption patterns under various strategies",
    workload_id: 4,
    platform_id: 1,
    workload_name: "Batch Processing Tasks",
    platform_name: "Cluster-128",
    created_at: "2024-12-05T16:20:00Z",
    creator_username: "admin",
  },
];

// Mock Strategies
export const mockStrategies: MockStrategy[] = [
  {
    id: 1,
    name: "FCFS Scheduler",
    description: "First-Come-First-Served scheduling algorithm",
    file_path: "/strategies/fcfs.py",
    file_size: 12000,
    file_type: "text/x-python",
    created_at: "2024-11-10T08:00:00Z",
    creator_username: "admin",
    main_entry: "fcfs_scheduler.py",
  },
  {
    id: 2,
    name: "Easy Backfill",
    description: "EASY backfilling scheduling strategy",
    file_path: "/strategies/easy_backfill.py",
    file_size: 18000,
    file_type: "text/x-python",
    created_at: "2024-11-12T10:30:00Z",
    creator_username: "researcher",
    main_entry: "easy_backfill.py",
  },
  {
    id: 3,
    name: "Conservative Backfill",
    description: "Conservative backfilling with reservation",
    file_path: "/strategies/conservative_bf.py",
    file_size: 22000,
    file_type: "text/x-python",
    created_at: "2024-11-14T14:15:00Z",
    creator_username: "admin",
    main_entry: "conservative_bf.py",
  },
  {
    id: 4,
    name: "Energy-Aware Scheduler",
    description: "Energy-efficient scheduling with DVFS support",
    file_path: "/strategies/energy_aware.py",
    file_size: 28000,
    file_type: "text/x-python",
    created_at: "2024-11-16T09:45:00Z",
    creator_username: "researcher",
    main_entry: "energy_scheduler.py",
  },
  {
    id: 5,
    name: "ML-Based Predictor",
    description: "Machine learning-based job runtime prediction scheduler",
    file_path: "/strategies/ml_predictor.py",
    file_size: 45000,
    file_type: "text/x-python",
    created_at: "2024-11-18T11:30:00Z",
    creator_username: "researcher ",
    main_entry: "ml_scheduler.py",
  },
];

// Mock Experiments
export const mockExperiments: MockExperiment[] = [
  {
    id: 1,
    name: "HPC-FCFS-Baseline",
    description: "Baseline experiment using FCFS on HPC cluster",
    scenario_id: 1,
    strategy_id: 1,
    scenario_name: "HPC Batch Processing",
    strategy_name: "FCFS Scheduler",
    status: "completed",
    progress_percentage: 100,
    completed_jobs: 1000,
    total_jobs: 1000,
    start_time: "2024-12-06T08:00:00Z",
    end_time: "2024-12-06T12:45:00Z",
    created_at: "2024-12-06T07:55:00Z",
    creator_username: "admin",
  },
  {
    id: 2,
    name: "Cloud-Burst-EasyBF",
    description: "Cloud burst scenario with Easy Backfill",
    scenario_id: 2,
    strategy_id: 2,
    scenario_name: "Cloud Burst Test",
    strategy_name: "Easy Backfill",
    status: "running",
    progress_percentage: 67,
    completed_jobs: 3350,
    total_jobs: 5000,
    start_time: "2024-12-08T10:00:00Z",
    end_time: null,
    created_at: "2024-12-08T09:55:00Z",
    creator_username: "researcher",
  },
  {
    id: 3,
    name: "ML-Training-Conservative",
    description: "ML training with conservative backfill",
    scenario_id: 3,
    strategy_id: 3,
    scenario_name: "ML Training Pipeline",
    strategy_name: "Conservative Backfill",
    status: "running",
    progress_percentage: 45,
    completed_jobs: 90,
    total_jobs: 200,
    start_time: "2024-12-08T14:30:00Z",
    end_time: null,
    created_at: "2024-12-08T14:25:00Z",
    creator_username: "data_scientist",
  },
  {
    id: 4,
    name: "Energy-Study-Aware",
    description: "Energy efficiency study with energy-aware scheduler",
    scenario_id: 5,
    strategy_id: 4,
    scenario_name: "Energy Efficiency Study",
    strategy_name: "Energy-Aware Scheduler",
    status: "paused",
    progress_percentage: 32,
    completed_jobs: 256,
    total_jobs: 800,
    start_time: "2024-12-07T16:00:00Z",
    end_time: null,
    created_at: "2024-12-07T15:55:00Z",
    creator_username: "admin",
  },
  {
    id: 5,
    name: "Edge-ML-Predictor",
    description: "Edge computing with ML-based scheduler",
    scenario_id: 4,
    strategy_id: 5,
    scenario_name: "Edge Computing Analysis",
    strategy_name: "ML-Based Predictor",
    status: "pending",
    progress_percentage: 0,
    completed_jobs: 0,
    total_jobs: 3000,
    start_time: null,
    end_time: null,
    created_at: "2024-12-08T18:00:00Z",
    creator_username: "analyst",
  },
  {
    id: 6,
    name: "HPC-Backfill-Compare",
    description: "Comparing backfill strategies on HPC",
    scenario_id: 1,
    strategy_id: 2,
    scenario_name: "HPC Batch Processing",
    strategy_name: "Easy Backfill",
    status: "completed",
    progress_percentage: 100,
    completed_jobs: 1000,
    total_jobs: 1000,
    start_time: "2024-12-05T09:00:00Z",
    end_time: "2024-12-05T11:30:00Z",
    created_at: "2024-12-05T08:55:00Z",
    creator_username: "researcher",
  },
  {
    id: 7,
    name: "Cloud-Energy-Test",
    description: "Energy consumption on cloud platform",
    scenario_id: 2,
    strategy_id: 4,
    scenario_name: "Cloud Burst Test",
    strategy_name: "Energy-Aware Scheduler",
    status: "failed",
    progress_percentage: 78,
    completed_jobs: 3900,
    total_jobs: 5000,
    start_time: "2024-12-04T14:00:00Z",
    end_time: "2024-12-04T18:23:00Z",
    created_at: "2024-12-04T13:55:00Z",
    creator_username: "admin",
  },
];

// Mock Results
export const mockResults: MockResult[] = [
  {
    id: 1,
    experiment_id: 1,
    experiment_name: "HPC-FCFS-Baseline",
    scenario_name: "HPC Batch Processing",
    strategy_name: "FCFS Scheduler",
    simulation_time: 17100,
    total_jobs: 1000,
    completed_jobs: 1000,
    failed_jobs: 0,
    makespan: 16850.5,
    average_waiting_time: 2340.8,
    average_turnaround_time: 5120.3,
    resource_utilization: 78.5,
    created_at: "2024-12-06T12:45:00Z",
  },
  {
    id: 2,
    experiment_id: 6,
    experiment_name: "HPC-Backfill-Compare",
    scenario_name: "HPC Batch Processing",
    strategy_name: "Easy Backfill",
    simulation_time: 9000,
    total_jobs: 1000,
    completed_jobs: 1000,
    failed_jobs: 0,
    makespan: 8920.2,
    average_waiting_time: 1120.5,
    average_turnaround_time: 3450.8,
    resource_utilization: 92.3,
    created_at: "2024-12-05T11:30:00Z",
  },
  {
    id: 3,
    experiment_id: 7,
    experiment_name: "Cloud-Energy-Test",
    scenario_name: "Cloud Burst Test",
    strategy_name: "Energy-Aware Scheduler",
    simulation_time: 15780,
    total_jobs: 5000,
    completed_jobs: 3900,
    failed_jobs: 1100,
    makespan: 15230.7,
    average_waiting_time: 890.3,
    average_turnaround_time: 2100.5,
    resource_utilization: 68.2,
    created_at: "2024-12-04T18:23:00Z",
  },
];

// Dashboard Stats
export const mockDashboardStats = {
  workloads: mockWorkloads.length,
  platforms: mockPlatforms.length,
  scenarios: mockScenarios.length,
  strategies: mockStrategies.length,
  experiments: mockExperiments.length,
  results: mockResults.length,
  runningExperiments: mockExperiments.filter((e) => e.status === "running").length,
  completedExperiments: mockExperiments.filter((e) => e.status === "completed").length,
  failedExperiments: mockExperiments.filter((e) => e.status === "failed").length,
  pendingExperiments: mockExperiments.filter((e) => e.status === "pending").length,
};

// System Resource Stats (for charts)
export const mockSystemStats = {
  cpu: [45, 52, 48, 67, 72, 65, 58, 61, 70, 75, 68, 63],
  memory: [62, 65, 68, 72, 70, 75, 78, 74, 71, 69, 73, 76],
  disk: [45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56],
  timestamps: [
    "00:00", "02:00", "04:00", "06:00", "08:00", "10:00",
    "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"
  ],
};

// Analytics Data
export const mockAnalyticsData = {
  total_results: mockResults.length,
  total_experiments: mockExperiments.length,
  avg_makespan: 13667.1,
  avg_waiting_time: 1450.5,
  avg_turnaround_time: 3557.2,
  avg_resource_utilization: 79.7,
  avg_utilization: 79.7,
  total_jobs: 7000,
  completed_jobs: 5900,
  failed_jobs: 1100,
  success_rate: 84.3,
  // Trend data (percentage change from previous period)
  experiment_trend: 12.5,
  utilization_trend: 3.2,
  makespan_trend: -5.8,
  success_trend: 2.1,
  // Performance chart data
  performance_data: [
    { label: "Week 1", value: 65 },
    { label: "Week 2", value: 72 },
    { label: "Week 3", value: 68 },
    { label: "Week 4", value: 78 },
    { label: "Week 5", value: 82 },
    { label: "Week 6", value: 75 },
    { label: "Week 7", value: 85 },
  ],
  results_by_date: [
    { date: "2024-12-01", count: 0 },
    { date: "2024-12-02", count: 0 },
    { date: "2024-12-03", count: 0 },
    { date: "2024-12-04", count: 1 },
    { date: "2024-12-05", count: 1 },
    { date: "2024-12-06", count: 1 },
  ],
  top_strategies: [
    { name: "Easy Backfill", count: 2 },
    { name: "FCFS Scheduler", count: 1 },
    { name: "Energy-Aware Scheduler", count: 1 },
  ],
  top_scenarios: [
    { name: "HPC Batch Processing", count: 2 },
    { name: "Cloud Burst Test", count: 1 },
  ],
};
