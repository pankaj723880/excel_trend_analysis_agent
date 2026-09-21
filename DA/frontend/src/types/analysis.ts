/**
 * Canonical Analysis Contract Types for Frontend Pages.
 * 
 * Guarantees that every page consumes strictly backend-calculated metrics
 * without independent recalculations.
 */

export interface AnalysisSummary {
  sheet_count: number
  total_rows: number
  total_missing: number
  total_duplicates: number
  workbook_health: number
  failed_sheets: number
}

export interface DimensionScore {
  score: number
  weight: number
}

export interface DataQualityResult {
  overall_score: number
  overall_raw: number
  status: 'healthy' | 'moderate' | 'attention_needed' | 'empty' | 'error'
  dimensions: {
    completeness: DimensionScore
    uniqueness: DimensionScore
    validity: DimensionScore
    consistency: DimensionScore
    structural_integrity: DimensionScore
  }
  core_health: {
    completeness: number
    uniqueness: number
    validity: number
    consistency: number
    structural_integrity: number
  }
  statistical_observations: {
    outliers_count: number
    statistical_anomalies_count: number
    explanation: string
  }
  validation_summary: {
    total_violations: number
    by_column: Record<string, number>
    by_rule: Record<string, number>
  }
  categorical_inconsistencies: Record<string, any>
  issues: Array<{
    dimension: string
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
    message: string
  }>
  recommendations: string[]
  details: {
    total_rows: number
    total_columns: number
    missing_cells: number
    missing_percentage: number
    duplicate_rows: number
    constant_columns: string[]
    outlier_count: number
    calculation_basis: string
  }
}

export interface ColumnNumericStats {
  count: number
  mean: number | null
  median: number | null
  min: number | null
  max: number | null
  std: number | null
  q1: number | null
  q3: number | null
  skewness: number | null
  kurtosis: number | null
  unique: number
  missing: number
  missing_pct: number
}

export interface EDAResult {
  numeric_statistics: Record<string, ColumnNumericStats>
  categorical_statistics: Record<string, any>
  datetime_statistics: Record<string, any>
  missing_summary: Record<string, { count: number; missing: number; missing_pct: number }>
  row_count: number
  column_count: number
  duplicate_count: number
  outlier_counts: Record<string, number>
  total_outliers_iqr: number
  columns: string[]
}

export interface ValidationViolation {
  column: string
  row: number
  row_index: number
  value: any
  rule: 'non_negative_count' | 'percentage_range' | 'date_range_anomaly' | string
  severity: 'error' | 'warning' | 'valid'
  message: string
}

export interface ValidationResult {
  total_violations: number
  error_count: number
  warning_count: number
  violations: ValidationViolation[]
  by_column: Record<string, number>
  by_rule: Record<string, number>
  by_severity: { error: number; warning: number }
}

export interface AnomalyItem {
  column: string
  metric: string
  row: number
  row_index: number
  date: string | null
  value: number
  type: string
  category: 'invalid_value' | 'statistical_outlier'
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  methods: string[]
  statistical_anomaly: boolean
  validation_violation: boolean
  reason: string
  primary_method: string
}

export interface AnomalyResult {
  by_metric: Record<string, AnomalyItem[]>
  all: AnomalyItem[]
  total: number
  total_detections: number
  unique_anomalous_observations: number
  method_counts: {
    iqr_outliers: number
    zscore_outliers: number
    sudden_changes: number
    domain_violations: number
  }
  methods_used: string[]
}

export interface CorrelationRelationship {
  column_a: string
  column_b: string
  x: string
  y: string
  correlation: number
  pearson_r: number
  n: number
  strength: 'strong' | 'moderate' | 'weak'
}

export interface TrendMetric {
  metric: string
  direction: string
  trend_score: number
  change_pct: number
  volatility_pct: number
  confidence: 'High' | 'Medium' | 'Low'
  r2?: number
  observations?: number
}

export interface CanonicalAnalysisResult {
  workbook_id: string | null
  analysis_version: string
  dataset_hash: string
  engine_version: string
  schema_version: string
  generated_at: number
  sheet_count: number
  total_rows: number
  total_missing: number
  total_duplicates: number
  total_invalid: number
  failed_sheets: number
  workbook_health: number
  sheets: Record<string, {
    sheet_name: string
    status: 'ok' | 'error'
    profile: any
    quality: DataQualityResult
    validation: ValidationResult
    categorical_inconsistencies: Record<string, any>
    eda: EDAResult
    trends: Record<string, TrendMetric>
    kpis: any[]
    anomalies: AnomalyResult
    correlations: {
      matrix: Record<string, Record<string, number | null>>
      strongest_positive: CorrelationRelationship[]
      strongest_negative: CorrelationRelationship[]
    }
  }>
}
