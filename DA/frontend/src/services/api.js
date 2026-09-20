import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const client = axios.create({
  baseURL: API_BASE,
  timeout: 300000,
  headers: { 'Content-Type': 'application/json' },
})

// ---------- Upload + Analysis ----------

export async function uploadWorkbook(file, onProgress) {
  const form = new FormData()
  form.append('file', file)
  const response = await client.post('/upload', form, {
    timeout: 300000,
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    },
  })
  return response.data
}

export async function listWorkbooks() {
  const { data } = await client.get('/workbooks')
  return data
}

export async function getWorkbookOverview(workbookId) {
  const { data } = await client.get(`/workbook/${workbookId}`)
  return data
}

export async function getWorkbookSheets(workbookId) {
  const { data } = await client.get(`/workbook/${workbookId}/sheets`)
  return data
}

export async function getSheetDetail(workbookId, sheetName) {
  const { data } = await client.get(
    `/workbook/${workbookId}/sheet/${encodeURIComponent(sheetName)}`
  )
  return data
}

export async function getEda(workbookId) {
  const { data } = await client.get(`/workbook/${workbookId}/eda`)
  return data
}

export async function getTrends(workbookId) {
  const { data } = await client.get(`/workbook/${workbookId}/trends`)
  return data
}

export async function getAnomalies(workbookId) {
  const { data } = await client.get(`/workbook/${workbookId}/anomalies`)
  return data
}

export async function getCorrelations(workbookId) {
  const { data } = await client.get(`/workbook/${workbookId}/correlations`)
  return data
}

export async function getChartSeries(workbookId, sheetName, metric) {
  const params = metric ? { metric } : {}
  const { data } = await client.get(
    `/workbook/${workbookId}/chart/${encodeURIComponent(sheetName)}`,
    { params }
  )
  return data
}

export async function runAnalyze(workbookId) {
  const { data } = await client.post('/analyze', { workbook_id: workbookId })
  return data
}

// ---------- Cleaning ----------

export async function cleanWorkbook(payload) {
  const { data } = await client.post('/clean', payload)
  return data
}

export async function getCleaningReport(workbookId) {
  const { data } = await client.get(`/workbook/${workbookId}/cleaning-report`)
  return data
}

export async function getCleanedPreview(workbookId, sheetName) {
  const { data } = await client.get(
    `/workbook/${workbookId}/cleaned/preview/${encodeURIComponent(sheetName)}`
  )
  return data
}

// ---------- AI ----------

export async function askQuestion(workbookIdOrObj, maybeQuestion) {
  let workbook_id = ''
  let question = ''
  if (typeof workbookIdOrObj === 'object' && workbookIdOrObj !== null) {
    workbook_id = workbookIdOrObj.workbook_id || workbookIdOrObj.workbookId
    question = workbookIdOrObj.question
  } else {
    workbook_id = workbookIdOrObj
    question = maybeQuestion
  }
  const { data } = await client.post('/ask', { workbook_id, question })
  return data
}

export async function generateAISummary(workbookId) {
  const { data } = await client.post('/ai-summary', { workbook_id: workbookId })
  return data
}

export async function getDomainContext(workbookId) {
  const { data } = await client.get(`/domain-context/${workbookId}`)
  return data
}

export async function getAIReport(workbookId) {
  const { data } = await client.get(`/report/${workbookId}`)
  return data
}

export async function getConversations(workbookId) {
  const { data } = await client.get(`/workbooks/${workbookId}/conversations`)
  return data
}

export async function getWorkbookInsights(workbookId) {
  const { data } = await client.get(`/workbooks/${workbookId}/insights`)
  return data
}


// ---------- Export ----------

export function getExportUrl(workbookId) {
  return `${API_BASE}/export/${workbookId}`
}

export function getReportHtmlUrl(workbookId) {
  return `${API_BASE}/export/${workbookId}/report-html`
}

export function getReportExcelUrl(workbookId) {
  return `${API_BASE}/export/${workbookId}/report-excel`
}

export function getCleanedExportUrl(workbookId) {
  return `${API_BASE}/export/${workbookId}/cleaned-workbook`
}

// ---------- MIS ----------

export async function getMisMapping(workbookId) {
  const { data } = await client.get(`/workbook/${workbookId}/mis/mapping`)
  return data
}

export async function saveMisMapping(workbookId, mapping) {
  const { data } = await client.post(`/workbook/${workbookId}/mis/mapping`, mapping)
  return data
}

export async function getMisFilters(workbookId) {
  const { data } = await client.get(`/workbook/${workbookId}/mis/filters`)
  return data
}

export async function getMisOverview(workbookId, filters = {}) {
  const { data } = await client.post(`/workbook/${workbookId}/mis/overview`, filters)
  return data
}

export async function getDailyMis(workbookId, payload = {}) {
  const { data } = await client.post(`/workbook/${workbookId}/mis/daily`, payload)
  return data
}

export async function getSalesMis(workbookId, filters = {}) {
  const { data } = await client.post(`/workbook/${workbookId}/mis/sales`, filters)
  return data
}

export async function getSalesDrilldown(workbookId, payload = {}) {
  const { data } = await client.post(`/workbook/${workbookId}/mis/sales/drilldown`, payload)
  return data
}

export async function getPurchaseMis(workbookId, filters = {}) {
  const { data } = await client.post(`/workbook/${workbookId}/mis/purchase`, filters)
  return data
}

export async function getInventoryMis(workbookId, filters = {}) {
  const { data } = await client.post(`/workbook/${workbookId}/mis/inventory`, filters)
  return data
}

export async function getFinanceMis(workbookId, filters = {}) {
  const { data } = await client.post(`/workbook/${workbookId}/mis/finance`, filters)
  return data
}

export async function getTargetVsActual(workbookId, filters = {}) {
  const { data } = await client.post(`/workbook/${workbookId}/mis/target-actual`, filters)
  return data
}

export async function getMomYoy(workbookId, payload = {}) {
  const { data } = await client.post(`/workbook/${workbookId}/mis/mom-yoy`, payload)
  return data
}

export async function getReconciliation(workbookId, payload = {}) {
  const { data } = await client.post(`/workbook/${workbookId}/mis/reconciliation`, payload)
  return data
}

export async function getDataValidation(workbookId) {
  const { data } = await client.post(`/workbook/${workbookId}/mis/validation`)
  return data
}

export async function getExceptions(workbookId) {
  const { data } = await client.get(`/workbook/${workbookId}/mis/exceptions`)
  return data
}

export async function updateExceptionStatus(workbookId, exceptionId, status) {
  const { data } = await client.post(`/workbook/${workbookId}/mis/exceptions/${exceptionId}/status`, { status })
  return data
}

export async function buildMisReport(workbookId, config) {
  const { data } = await client.post(`/workbook/${workbookId}/mis/reports/builder`, config)
  return data
}

export async function getScheduledReports(workbookId) {
  const { data } = await client.get(`/workbook/${workbookId}/mis/reports/scheduled`)
  return data
}

export async function addScheduledReport(workbookId, report) {
  const { data } = await client.post(`/workbook/${workbookId}/mis/reports/scheduled`, report)
  return data
}

export async function getMasterData(workbookId, entityType = 'Products') {
  const { data } = await client.get(`/workbook/${workbookId}/mis/master-data`, { params: { entity_type: entityType } })
  return data
}

export async function misAiAssistant(workbookId, question) {
  const { data } = await client.post(`/workbook/${workbookId}/mis/ai-assistant`, { question })
  return data
}

export async function refreshMisData(workbookId) {
  const { data } = await client.post(`/workbook/${workbookId}/mis/refresh`)
  return data
}

export default client
