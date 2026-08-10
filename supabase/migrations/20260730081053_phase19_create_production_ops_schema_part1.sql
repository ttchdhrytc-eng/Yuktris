/*
# Phase 19 — Production Operations Platform (Part 1/3)

## Observability, Monitoring, Queue & Performance Tables

Note: table name `system_performance_metrics` used instead of `performance_metrics`
because an earlier phase already created a `performance_metrics` table for campaign tracking.

### New Tables (10)
1. system_logs — System-level log entries
2. application_logs — Application logs with severity, source, correlation IDs
3. system_performance_metrics — Time-series performance metrics (CPU, memory, latency)
4. distributed_traces — Distributed tracing spans
5. queue_jobs — Distributed job queue with priority, retries, delays
6. queue_workers — Worker registration and heartbeat tracking
7. worker_health — Worker health checks
8. cache_metrics — Cache hit/miss ratios
9. cost_tracking — AI spend, API costs, infrastructure costs
10. resource_usage — Resource consumption snapshots

### Security
- RLS enabled on every table
- 4 CRUD policies per table scoped via workspace_members join
- All tables have workspace_id for isolation
*/

-- 1. system_logs
CREATE TABLE IF NOT EXISTS system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  log_level text NOT NULL DEFAULT 'info' CHECK (log_level IN ('debug','info','warn','error','fatal')),
  log_source text NOT NULL,
  log_message text NOT NULL,
  log_metadata jsonb DEFAULT '{}'::jsonb,
  correlation_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_system_logs_workspace ON system_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_system_logs_source ON system_logs(log_source);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_correlation ON system_logs(correlation_id);

DROP POLICY IF EXISTS "select_own_system_logs" ON system_logs;
CREATE POLICY "select_own_system_logs" ON system_logs FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = system_logs.workspace_id));
DROP POLICY IF EXISTS "insert_own_system_logs" ON system_logs;
CREATE POLICY "insert_own_system_logs" ON system_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = system_logs.workspace_id));
DROP POLICY IF EXISTS "update_own_system_logs" ON system_logs;
CREATE POLICY "update_own_system_logs" ON system_logs FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = system_logs.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = system_logs.workspace_id));
DROP POLICY IF EXISTS "delete_own_system_logs" ON system_logs;
CREATE POLICY "delete_own_system_logs" ON system_logs FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = system_logs.workspace_id));

-- 2. application_logs
CREATE TABLE IF NOT EXISTS application_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  log_level text NOT NULL DEFAULT 'info' CHECK (log_level IN ('debug','info','warn','error','fatal')),
  log_category text NOT NULL CHECK (log_category IN ('application','api','ai','workflow','agent','edge_function','database','auth','webhook','integration','security','audit','system')),
  source_module text NOT NULL,
  log_message text NOT NULL,
  stack_trace text,
  correlation_id text,
  request_id text,
  user_id uuid,
  duration_ms integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE application_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_app_logs_workspace ON application_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_app_logs_level ON application_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_app_logs_category ON application_logs(log_category);
CREATE INDEX IF NOT EXISTS idx_app_logs_module ON application_logs(source_module);
CREATE INDEX IF NOT EXISTS idx_app_logs_created ON application_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_correlation ON application_logs(correlation_id);

DROP POLICY IF EXISTS "select_own_application_logs" ON application_logs;
CREATE POLICY "select_own_application_logs" ON application_logs FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = application_logs.workspace_id));
DROP POLICY IF EXISTS "insert_own_application_logs" ON application_logs;
CREATE POLICY "insert_own_application_logs" ON application_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = application_logs.workspace_id));
DROP POLICY IF EXISTS "update_own_application_logs" ON application_logs;
CREATE POLICY "update_own_application_logs" ON application_logs FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = application_logs.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = application_logs.workspace_id));
DROP POLICY IF EXISTS "delete_own_application_logs" ON application_logs;
CREATE POLICY "delete_own_application_logs" ON application_logs FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = application_logs.workspace_id));

-- 3. system_performance_metrics
CREATE TABLE IF NOT EXISTS system_performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  metric_name text NOT NULL,
  metric_category text NOT NULL CHECK (metric_category IN ('cpu','memory','storage','network','database','api','ai_gateway','cache','queue','worker','latency','throughput','error_rate','uptime')),
  metric_value numeric NOT NULL,
  metric_unit text,
  metric_labels jsonb DEFAULT '{}'::jsonb,
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE system_performance_metrics ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_sys_perf_metrics_workspace ON system_performance_metrics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sys_perf_metrics_name ON system_performance_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_sys_perf_metrics_category ON system_performance_metrics(metric_category);
CREATE INDEX IF NOT EXISTS idx_sys_perf_metrics_recorded ON system_performance_metrics(recorded_at DESC);

DROP POLICY IF EXISTS "select_own_sys_perf_metrics" ON system_performance_metrics;
CREATE POLICY "select_own_sys_perf_metrics" ON system_performance_metrics FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = system_performance_metrics.workspace_id));
DROP POLICY IF EXISTS "insert_own_sys_perf_metrics" ON system_performance_metrics;
CREATE POLICY "insert_own_sys_perf_metrics" ON system_performance_metrics FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = system_performance_metrics.workspace_id));
DROP POLICY IF EXISTS "update_own_sys_perf_metrics" ON system_performance_metrics;
CREATE POLICY "update_own_sys_perf_metrics" ON system_performance_metrics FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = system_performance_metrics.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = system_performance_metrics.workspace_id));
DROP POLICY IF EXISTS "delete_own_sys_perf_metrics" ON system_performance_metrics;
CREATE POLICY "delete_own_sys_perf_metrics" ON system_performance_metrics FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = system_performance_metrics.workspace_id));

-- 4. distributed_traces
CREATE TABLE IF NOT EXISTS distributed_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  trace_id text NOT NULL,
  span_id text NOT NULL,
  parent_span_id text,
  service_name text NOT NULL,
  operation_name text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  duration_ms integer,
  span_status text NOT NULL DEFAULT 'ok' CHECK (span_status IN ('ok','error','timeout','cancelled')),
  span_attributes jsonb DEFAULT '{}'::jsonb,
  span_events jsonb DEFAULT '[]'::jsonb,
  resource_tags jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE distributed_traces ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_traces_workspace ON distributed_traces(workspace_id);
CREATE INDEX IF NOT EXISTS idx_traces_trace_id ON distributed_traces(trace_id);
CREATE INDEX IF NOT EXISTS idx_traces_span_id ON distributed_traces(span_id);
CREATE INDEX IF NOT EXISTS idx_traces_service ON distributed_traces(service_name);
CREATE INDEX IF NOT EXISTS idx_traces_created ON distributed_traces(created_at DESC);

DROP POLICY IF EXISTS "select_own_distributed_traces" ON distributed_traces;
CREATE POLICY "select_own_distributed_traces" ON distributed_traces FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = distributed_traces.workspace_id));
DROP POLICY IF EXISTS "insert_own_distributed_traces" ON distributed_traces;
CREATE POLICY "insert_own_distributed_traces" ON distributed_traces FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = distributed_traces.workspace_id));
DROP POLICY IF EXISTS "update_own_distributed_traces" ON distributed_traces;
CREATE POLICY "update_own_distributed_traces" ON distributed_traces FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = distributed_traces.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = distributed_traces.workspace_id));
DROP POLICY IF EXISTS "delete_own_distributed_traces" ON distributed_traces;
CREATE POLICY "delete_own_distributed_traces" ON distributed_traces FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = distributed_traces.workspace_id));

-- 5. queue_jobs
CREATE TABLE IF NOT EXISTS queue_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  queue_name text NOT NULL DEFAULT 'default',
  job_type text NOT NULL,
  job_payload jsonb DEFAULT '{}'::jsonb,
  priority integer NOT NULL DEFAULT 0 CHECK (priority >= 0 AND priority <= 10),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','completed','failed','delayed','cancelled','dead_letter')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  delay_until timestamptz,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  worker_id text,
  error_message text,
  error_stack text,
  result jsonb,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE queue_jobs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_queue_jobs_workspace ON queue_jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_status ON queue_jobs(status);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_queue ON queue_jobs(queue_name);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_priority ON queue_jobs(priority DESC);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_type ON queue_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_created ON queue_jobs(created_at DESC);

DROP POLICY IF EXISTS "select_own_queue_jobs" ON queue_jobs;
CREATE POLICY "select_own_queue_jobs" ON queue_jobs FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = queue_jobs.workspace_id));
DROP POLICY IF EXISTS "insert_own_queue_jobs" ON queue_jobs;
CREATE POLICY "insert_own_queue_jobs" ON queue_jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = queue_jobs.workspace_id));
DROP POLICY IF EXISTS "update_own_queue_jobs" ON queue_jobs;
CREATE POLICY "update_own_queue_jobs" ON queue_jobs FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = queue_jobs.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = queue_jobs.workspace_id));
DROP POLICY IF EXISTS "delete_own_queue_jobs" ON queue_jobs;
CREATE POLICY "delete_own_queue_jobs" ON queue_jobs FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = queue_jobs.workspace_id));

-- 6. queue_workers
CREATE TABLE IF NOT EXISTS queue_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  worker_id text NOT NULL UNIQUE,
  worker_name text NOT NULL,
  worker_type text NOT NULL,
  queue_names text[] DEFAULT '{default}'::text[],
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','busy','paused','offline','error')),
  concurrency integer NOT NULL DEFAULT 1,
  max_concurrency integer NOT NULL DEFAULT 5,
  current_job_id uuid,
  jobs_completed integer NOT NULL DEFAULT 0,
  jobs_failed integer NOT NULL DEFAULT 0,
  last_heartbeat_at timestamptz DEFAULT now(),
  started_at timestamptz DEFAULT now(),
  stopped_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE queue_workers ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_queue_workers_workspace ON queue_workers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_queue_workers_status ON queue_workers(status);
CREATE INDEX IF NOT EXISTS idx_queue_workers_worker_id ON queue_workers(worker_id);

DROP POLICY IF EXISTS "select_own_queue_workers" ON queue_workers;
CREATE POLICY "select_own_queue_workers" ON queue_workers FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = queue_workers.workspace_id));
DROP POLICY IF EXISTS "insert_own_queue_workers" ON queue_workers;
CREATE POLICY "insert_own_queue_workers" ON queue_workers FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = queue_workers.workspace_id));
DROP POLICY IF EXISTS "update_own_queue_workers" ON queue_workers;
CREATE POLICY "update_own_queue_workers" ON queue_workers FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = queue_workers.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = queue_workers.workspace_id));
DROP POLICY IF EXISTS "delete_own_queue_workers" ON queue_workers;
CREATE POLICY "delete_own_queue_workers" ON queue_workers FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = queue_workers.workspace_id));

-- 7. worker_health
CREATE TABLE IF NOT EXISTS worker_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  worker_id text NOT NULL,
  health_status text NOT NULL CHECK (health_status IN ('healthy','degraded','unhealthy','recovering')),
  cpu_usage numeric,
  memory_usage numeric,
  event_loop_lag_ms numeric,
  active_connections integer,
  queue_depth integer,
  uptime_seconds bigint,
  error_count integer DEFAULT 0,
  warning_count integer DEFAULT 0,
  health_metadata jsonb DEFAULT '{}'::jsonb,
  checked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE worker_health ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_worker_health_workspace ON worker_health(workspace_id);
CREATE INDEX IF NOT EXISTS idx_worker_health_worker ON worker_health(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_health_status ON worker_health(health_status);
CREATE INDEX IF NOT EXISTS idx_worker_health_checked ON worker_health(checked_at DESC);

DROP POLICY IF EXISTS "select_own_worker_health" ON worker_health;
CREATE POLICY "select_own_worker_health" ON worker_health FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = worker_health.workspace_id));
DROP POLICY IF EXISTS "insert_own_worker_health" ON worker_health;
CREATE POLICY "insert_own_worker_health" ON worker_health FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = worker_health.workspace_id));
DROP POLICY IF EXISTS "update_own_worker_health" ON worker_health;
CREATE POLICY "update_own_worker_health" ON worker_health FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = worker_health.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = worker_health.workspace_id));
DROP POLICY IF EXISTS "delete_own_worker_health" ON worker_health;
CREATE POLICY "delete_own_worker_health" ON worker_health FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = worker_health.workspace_id));

-- 8. cache_metrics
CREATE TABLE IF NOT EXISTS cache_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  cache_name text NOT NULL,
  cache_type text NOT NULL DEFAULT 'redis' CHECK (cache_type IN ('redis','memory','api','query','image','cdn')),
  hit_count integer NOT NULL DEFAULT 0,
  miss_count integer NOT NULL DEFAULT 0,
  eviction_count integer NOT NULL DEFAULT 0,
  total_keys integer NOT NULL DEFAULT 0,
  memory_usage_bytes bigint,
  hit_ratio numeric,
  avg_latency_ms numeric,
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE cache_metrics ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_cache_metrics_workspace ON cache_metrics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_cache_metrics_name ON cache_metrics(cache_name);
CREATE INDEX IF NOT EXISTS idx_cache_metrics_type ON cache_metrics(cache_type);
CREATE INDEX IF NOT EXISTS idx_cache_metrics_recorded ON cache_metrics(recorded_at DESC);

DROP POLICY IF EXISTS "select_own_cache_metrics" ON cache_metrics;
CREATE POLICY "select_own_cache_metrics" ON cache_metrics FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = cache_metrics.workspace_id));
DROP POLICY IF EXISTS "insert_own_cache_metrics" ON cache_metrics;
CREATE POLICY "insert_own_cache_metrics" ON cache_metrics FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = cache_metrics.workspace_id));
DROP POLICY IF EXISTS "update_own_cache_metrics" ON cache_metrics;
CREATE POLICY "update_own_cache_metrics" ON cache_metrics FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = cache_metrics.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = cache_metrics.workspace_id));
DROP POLICY IF EXISTS "delete_own_cache_metrics" ON cache_metrics;
CREATE POLICY "delete_own_cache_metrics" ON cache_metrics FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = cache_metrics.workspace_id));

-- 9. cost_tracking
CREATE TABLE IF NOT EXISTS cost_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  cost_category text NOT NULL CHECK (cost_category IN ('ai_spend','api_usage','infrastructure','storage','bandwidth','edge_functions','database','third_party','other')),
  cost_source text NOT NULL,
  cost_amount numeric NOT NULL DEFAULT 0,
  cost_currency text NOT NULL DEFAULT 'USD',
  usage_quantity numeric,
  usage_unit text,
  billing_period text,
  recorded_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE cost_tracking ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_cost_tracking_workspace ON cost_tracking(workspace_id);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_category ON cost_tracking(cost_category);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_source ON cost_tracking(cost_source);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_recorded ON cost_tracking(recorded_at DESC);

DROP POLICY IF EXISTS "select_own_cost_tracking" ON cost_tracking;
CREATE POLICY "select_own_cost_tracking" ON cost_tracking FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = cost_tracking.workspace_id));
DROP POLICY IF EXISTS "insert_own_cost_tracking" ON cost_tracking;
CREATE POLICY "insert_own_cost_tracking" ON cost_tracking FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = cost_tracking.workspace_id));
DROP POLICY IF EXISTS "update_own_cost_tracking" ON cost_tracking;
CREATE POLICY "update_own_cost_tracking" ON cost_tracking FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = cost_tracking.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = cost_tracking.workspace_id));
DROP POLICY IF EXISTS "delete_own_cost_tracking" ON cost_tracking;
CREATE POLICY "delete_own_cost_tracking" ON cost_tracking FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = cost_tracking.workspace_id));

-- 10. resource_usage
CREATE TABLE IF NOT EXISTS resource_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  resource_type text NOT NULL CHECK (resource_type IN ('cpu','memory','storage','network','database','edge_function','worker','queue','cache')),
  resource_name text NOT NULL,
  usage_value numeric NOT NULL,
  usage_unit text NOT NULL,
  usage_percent numeric,
  quota_limit numeric,
  quota_percent numeric,
  labels jsonb DEFAULT '{}'::jsonb,
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE resource_usage ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_resource_usage_workspace ON resource_usage(workspace_id);
CREATE INDEX IF NOT EXISTS idx_resource_usage_type ON resource_usage(resource_type);
CREATE INDEX IF NOT EXISTS idx_resource_usage_name ON resource_usage(resource_name);
CREATE INDEX IF NOT EXISTS idx_resource_usage_recorded ON resource_usage(recorded_at DESC);

DROP POLICY IF EXISTS "select_own_resource_usage" ON resource_usage;
CREATE POLICY "select_own_resource_usage" ON resource_usage FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = resource_usage.workspace_id));
DROP POLICY IF EXISTS "insert_own_resource_usage" ON resource_usage;
CREATE POLICY "insert_own_resource_usage" ON resource_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = resource_usage.workspace_id));
DROP POLICY IF EXISTS "update_own_resource_usage" ON resource_usage;
CREATE POLICY "update_own_resource_usage" ON resource_usage FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = resource_usage.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = resource_usage.workspace_id));
DROP POLICY IF EXISTS "delete_own_resource_usage" ON resource_usage;
CREATE POLICY "delete_own_resource_usage" ON resource_usage FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = resource_usage.workspace_id));