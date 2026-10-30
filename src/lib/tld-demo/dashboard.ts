type Dataset = 'cic' | 'surbl';
type HalfLife = '3' | '6' | '12' | '24';
type MetricKind = 'rate' | 'count' | 'velocity' | 'acceleration';
type Scalar = string | number | null;

interface DataRow extends Record<string, Scalar> {
  TLD: string;
  period: string;
  cf_d: number | null;
  tld_dum: number | null;
}

interface CategoryRow {
  tld: string;
  in_root: 0 | 1;
  category: string;
}

interface PriceRow extends Record<string, Scalar> {
  tld: string;
  reg_price: number | null;
  reg_currency: string | null;
  renew_price: number | null;
  renew_currency: string | null;
  transfer_price: number | null;
  transfer_currency: string | null;
  best3_reg_price: number | null;
  best3_reg_currency: string | null;
  best3_renew_price: number | null;
  best3_renew_currency: string | null;
}

interface CoverageSummary {
  rowCount: number;
  tldCount: number;
  minPeriod: string | null;
  maxPeriod: string | null;
}

interface FileSummary {
  bytes: number;
  gzipBytes: number;
  path: string;
  sha256: string;
}

interface Manifest {
  schemaVersion: number;
  snapshotId: string;
  generatedAt: string;
  priceSnapshotDate: string;
  coverage: {
    cic: CoverageSummary;
    surbl: CoverageSummary;
    categories: {
      rowCount: number;
      tldCount: number;
      rootTldCount: number;
      categories: Record<string, number>;
    };
    prices: {
      rowCount: number;
      tldCount: number;
    };
  };
  files: Record<string, FileSummary>;
  warnings: string[];
}

interface Snapshot {
  manifest: Manifest;
  categories: CategoryRow[];
  prices: PriceRow[];
  cic: DataRow[];
  surbl: DataRow[];
}

interface MetricOption {
  id: string;
  label: string;
  shortLabel: string;
  field?: string;
  fields?: Record<HalfLife, string>;
  kind: MetricKind;
  description: string;
}

interface Controls {
  dataset: Dataset;
  metric: MetricOption;
  halfLife: HalfLife;
  categories: Set<string>;
  rootOnly: boolean;
  autoPick: boolean;
  topN: number;
  confidenceThreshold: number | null;
}

interface LatestRow {
  tld: string;
  row: DataRow;
  category: CategoryRow;
  price: PriceRow | null;
  firstPeriod: string;
  lastPeriod: string;
  months: number;
  value: number | null;
}

interface ChartPoint {
  tld: string;
  period: string;
  value: number;
  x: number;
  y: number;
  color: string;
}

interface Indexes {
  categoriesByTld: Map<string, CategoryRow>;
  pricesByTld: Map<string, PriceRow>;
  rowsByTld: Record<Dataset, Map<string, DataRow[]>>;
}

const HALF_LIVES: HalfLife[] = ['3', '6', '12', '24'];
const COLORS = [
  '#3b82f6',
  '#f97316',
  '#22c55e',
  '#e11d48',
  '#a855f7',
  '#14b8a6',
  '#f59e0b',
  '#ec4899',
  '#84cc16',
  '#06b6d4',
  '#f43f5e',
  '#8b5cf6',
  '#10b981',
  '#fb7185',
  '#38bdf8',
  '#d946ef',
  '#65a30d',
  '#facc15',
  '#2dd4bf',
  '#60a5fa',
];

const METRICS: Record<Dataset, MetricOption[]> = {
  cic: [
    {
      id: 'ewma_sum',
      label: 'EWMA (sum)',
      shortLabel: 'EWMA sum',
      fields: { '3': 'ewma3_sum', '6': 'ewma6_sum', '12': 'ewma12_sum', '24': 'ewma24_sum' },
      kind: 'rate',
      description: 'Smoothed category sum rate',
    },
    {
      id: 'ewma_max',
      label: 'EWMA (max)',
      shortLabel: 'EWMA max',
      fields: { '3': 'ewma3_max', '6': 'ewma6_max', '12': 'ewma12_max', '24': 'ewma24_max' },
      kind: 'rate',
      description: 'Smoothed category max rate',
    },
    {
      id: 'raw_sum',
      label: 'Raw (sum)',
      shortLabel: 'Raw sum',
      field: 'sumBadBps',
      kind: 'rate',
      description: 'Unsmoothed monthly category sum rate',
    },
    {
      id: 'raw_max',
      label: 'Raw (max)',
      shortLabel: 'Raw max',
      field: 'maxBadBps',
      kind: 'rate',
      description: 'Unsmoothed monthly category max rate',
    },
    {
      id: 'velocity_sum',
      label: 'Velocity (sum)',
      shortLabel: 'Velocity sum',
      field: 'vel_sum_bps',
      kind: 'velocity',
      description: 'Month-to-month change in CIC sum rate',
    },
    {
      id: 'velocity_max',
      label: 'Velocity (max)',
      shortLabel: 'Velocity max',
      field: 'vel_max_bps',
      kind: 'velocity',
      description: 'Month-to-month change in CIC max rate',
    },
    {
      id: 'acceleration_sum',
      label: 'Acceleration (sum)',
      shortLabel: 'Acceleration sum',
      field: 'acc_sum_bps',
      kind: 'acceleration',
      description: 'Change in CIC sum-rate velocity',
    },
    {
      id: 'acceleration_max',
      label: 'Acceleration (max)',
      shortLabel: 'Acceleration max',
      field: 'acc_max_bps',
      kind: 'acceleration',
      description: 'Change in CIC max-rate velocity',
    },
  ],
  surbl: [
    {
      id: 'ewma',
      label: 'EWMA',
      shortLabel: 'EWMA',
      fields: { '3': 'ewma3', '6': 'ewma6', '12': 'ewma12', '24': 'ewma24' },
      kind: 'rate',
      description: 'Smoothed SURBL normalized rate',
    },
    {
      id: 'raw',
      label: 'Raw rate',
      shortLabel: 'Raw rate',
      field: 'badBps',
      kind: 'rate',
      description: 'Unsmoothed SURBL normalized rate',
    },
    {
      id: 'bad_domains',
      label: 'Bad domains',
      shortLabel: 'Bad domains',
      field: 'badDomains',
      kind: 'count',
      description: 'Observed SURBL domain count',
    },
    {
      id: 'velocity',
      label: 'Velocity',
      shortLabel: 'Velocity',
      field: 'vel_bad_bps',
      kind: 'velocity',
      description: 'Month-to-month change in SURBL normalized rate',
    },
    {
      id: 'acceleration',
      label: 'Acceleration',
      shortLabel: 'Acceleration',
      field: 'acc_bad_bps',
      kind: 'acceleration',
      description: 'Change in SURBL velocity',
    },
  ],
};

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const preciseFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 });
const integerFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

let snapshot: Snapshot | null = null;
let indexes: Indexes | null = null;
let manualSelected = new Set<string>();

export function initTldDashboard(): void {
  const root = document.querySelector<HTMLElement>('[data-tld-dashboard]');
  if (!root || root.dataset.ready === 'true') {
    return;
  }
  root.dataset.ready = 'true';

  const snapshotBase = root.dataset.snapshotBase;
  if (!snapshotBase) {
    showLoadError(root, new Error('Missing snapshot base path.'));
    return;
  }

  const controls = collectElements(root);
  installStaticListeners(root, controls);
  setLoading(root, true);

  loadSnapshot(snapshotBase)
    .then((loaded) => {
      snapshot = loaded;
      indexes = buildIndexes(loaded);
      setLoading(root, false);
      setupCategories(controls, loaded.categories);
      syncMetricOptions(controls);
      render(root, controls);
    })
    .catch((error: unknown) => {
      setLoading(root, false);
      showLoadError(root, error instanceof Error ? error : new Error(String(error)));
    });
}

function collectElements(root: HTMLElement) {
  return {
    root,
    metricSelect: must<HTMLSelectElement>(root, '[data-control="metric"]'),
    halfLifeSelect: must<HTMLSelectElement>(root, '[data-control="half-life"]'),
    categoryList: must<HTMLElement>(root, '[data-category-list]'),
    rootOnly: must<HTMLInputElement>(root, '[data-control="root-only"]'),
    autoPick: must<HTMLInputElement>(root, '[data-control="auto-pick"]'),
    topRange: must<HTMLInputElement>(root, '[data-control="top-range"]'),
    topNumber: must<HTMLInputElement>(root, '[data-control="top-number"]'),
    confidence: must<HTMLSelectElement>(root, '[data-control="confidence"]'),
    tldSearch: must<HTMLInputElement>(root, '[data-control="tld-search"]'),
    tldSelect: must<HTMLSelectElement>(root, '[data-control="tld-select"]'),
    selectAllCategories: must<HTMLButtonElement>(root, '[data-action="select-all-categories"]'),
    clearCategories: must<HTMLButtonElement>(root, '[data-action="clear-categories"]'),
    clearManual: must<HTMLButtonElement>(root, '[data-action="clear-manual"]'),
    status: must<HTMLElement>(root, '[data-status]'),
    summary: must<HTMLElement>(root, '[data-summary]'),
    selectionNote: must<HTMLElement>(root, '[data-selection-note]'),
    chartSvg: must<SVGSVGElement>(root, '[data-chart]'),
    chartTooltip: must<HTMLElement>(root, '[data-chart-tooltip]'),
    chartEmpty: must<HTMLElement>(root, '[data-chart-empty]'),
    legend: must<HTMLElement>(root, '[data-legend]'),
    rankingTable: must<HTMLElement>(root, '[data-ranking-table]'),
    rankingCount: must<HTMLElement>(root, '[data-ranking-count]'),
  };
}

function must<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing dashboard element: ${selector}`);
  }
  return element;
}

function installStaticListeners(root: HTMLElement, controls: ReturnType<typeof collectElements>): void {
  root.querySelectorAll<HTMLInputElement>('input[name="dataset"]').forEach((input) => {
    input.addEventListener('change', () => {
      syncMetricOptions(controls);
      render(root, controls);
    });
  });

  controls.metricSelect.addEventListener('change', () => render(root, controls));
  controls.halfLifeSelect.addEventListener('change', () => render(root, controls));
  controls.rootOnly.addEventListener('change', () => render(root, controls));
  controls.autoPick.addEventListener('change', () => render(root, controls));
  controls.confidence.addEventListener('change', () => render(root, controls));
  controls.tldSearch.addEventListener('input', () => render(root, controls));
  controls.tldSelect.addEventListener('change', () => {
    manualSelected = new Set(Array.from(controls.tldSelect.selectedOptions).map((option) => option.value));
    render(root, controls);
  });

  controls.topRange.addEventListener('input', () => {
    controls.topNumber.value = controls.topRange.value;
    render(root, controls);
  });
  controls.topNumber.addEventListener('input', () => {
    const value = clampTopN(controls.topNumber.value);
    controls.topRange.value = String(value);
    controls.topNumber.value = String(value);
    render(root, controls);
  });

  controls.selectAllCategories.addEventListener('click', () => {
    controls.categoryList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((input) => {
      input.checked = true;
    });
    render(root, controls);
  });
  controls.clearCategories.addEventListener('click', () => {
    controls.categoryList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((input) => {
      input.checked = false;
    });
    render(root, controls);
  });
  controls.clearManual.addEventListener('click', () => {
    manualSelected.clear();
    render(root, controls);
  });
}

async function loadSnapshot(base: string): Promise<Snapshot> {
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const [manifest, categories, prices, cic, surbl] = await Promise.all([
    loadJson<Manifest>(`${cleanBase}/manifest.json`),
    loadJson<CategoryRow[]>(`${cleanBase}/categories.json`),
    loadJson<PriceRow[]>(`${cleanBase}/prices.json`),
    loadJson<DataRow[]>(`${cleanBase}/cic.json`),
    loadJson<DataRow[]>(`${cleanBase}/surbl.json`),
  ]);
  return { manifest, categories, prices, cic, surbl };
}

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load ${url}: ${response.status}`);
  }
  return (await response.json()) as T;
}

function buildIndexes(data: Snapshot): Indexes {
  const categoriesByTld = new Map(data.categories.map((row) => [row.tld, row]));
  const pricesByTld = new Map(data.prices.map((row) => [row.tld, row]));
  return {
    categoriesByTld,
    pricesByTld,
    rowsByTld: {
      cic: groupRows(data.cic),
      surbl: groupRows(data.surbl),
    },
  };
}

function groupRows(rows: DataRow[]): Map<string, DataRow[]> {
  const grouped = new Map<string, DataRow[]>();
  rows.forEach((row) => {
    const existing = grouped.get(row.TLD);
    if (existing) {
      existing.push(row);
    } else {
      grouped.set(row.TLD, [row]);
    }
  });
  grouped.forEach((value) => value.sort((a, b) => a.period.localeCompare(b.period)));
  return grouped;
}

function setupCategories(controls: ReturnType<typeof collectElements>, categories: CategoryRow[]): void {
  const names = Array.from(new Set(categories.map((row) => row.category))).sort();
  controls.categoryList.innerHTML = '';
  names.forEach((name) => {
    const label = document.createElement('label');
    label.className = 'check-pill';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'category';
    input.value = name;
    input.checked = true;
    input.addEventListener('change', () => render(controls.root, controls));
    label.append(input, document.createTextNode(formatCategory(name)));
    controls.categoryList.append(label);
  });
}

function syncMetricOptions(controls: ReturnType<typeof collectElements>): void {
  const dataset = getDataset(controls.root);
  const current = controls.metricSelect.value;
  const options = METRICS[dataset];
  controls.metricSelect.innerHTML = '';
  options.forEach((metric) => {
    const option = document.createElement('option');
    option.value = metric.id;
    option.textContent = metric.label;
    controls.metricSelect.append(option);
  });
  controls.metricSelect.value = options.some((metric) => metric.id === current) ? current : options[0].id;
  const metric = getMetric(dataset, controls.metricSelect.value);
  controls.halfLifeSelect.disabled = !metric.fields;
}

function render(root: HTMLElement, controls: ReturnType<typeof collectElements>): void {
  if (!snapshot || !indexes) {
    return;
  }

  const state = readControls(root, controls);
  controls.halfLifeSelect.disabled = !state.metric.fields;

  const latest = getLatestRows(state);
  const availableTlds = latest.map((row) => row.tld).sort();
  const removed = reconcileManualSelection(availableTlds);
  const ranking = sortRanking(latest).slice(0, state.topN);
  const picked = manualSelected.size > 0
    ? sortPicked(Array.from(manualSelected), state)
    : state.autoPick
      ? ranking.map((row) => row.tld)
      : [];

  renderSummary(controls.summary, snapshot.manifest, state);
  renderTldSelect(controls, availableTlds);
  renderSelectionNote(controls, removed, picked, state);
  renderChart(controls, picked, state);
  renderRanking(controls, ranking, state);
}

function readControls(root: HTMLElement, controls: ReturnType<typeof collectElements>): Controls {
  const dataset = getDataset(root);
  const metric = getMetric(dataset, controls.metricSelect.value);
  return {
    dataset,
    metric,
    halfLife: asHalfLife(controls.halfLifeSelect.value),
    categories: new Set(
      Array.from(controls.categoryList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked'))
        .map((input) => input.value),
    ),
    rootOnly: controls.rootOnly.checked,
    autoPick: controls.autoPick.checked,
    topN: clampTopN(controls.topNumber.value),
    confidenceThreshold: controls.confidence.value === 'all' ? null : Number(controls.confidence.value),
  };
}

function getDataset(root: HTMLElement): Dataset {
  const selected = root.querySelector<HTMLInputElement>('input[name="dataset"]:checked');
  return selected?.value === 'surbl' ? 'surbl' : 'cic';
}

function getMetric(dataset: Dataset, id: string): MetricOption {
  return METRICS[dataset].find((metric) => metric.id === id) ?? METRICS[dataset][0];
}

function asHalfLife(value: string): HalfLife {
  return HALF_LIVES.includes(value as HalfLife) ? (value as HalfLife) : '6';
}

function clampTopN(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 20;
  }
  return Math.min(200, Math.max(10, parsed));
}

function getField(metric: MetricOption, halfLife: HalfLife): string {
  return metric.fields ? metric.fields[halfLife] : metric.field ?? '';
}

function getLatestRows(state: Controls): LatestRow[] {
  if (!indexes) {
    return [];
  }
  const grouped = indexes.rowsByTld[state.dataset];
  const field = getField(state.metric, state.halfLife);
  const rows: LatestRow[] = [];

  grouped.forEach((series, tld) => {
    const category = indexes?.categoriesByTld.get(tld);
    if (!category || !state.categories.has(category.category)) {
      return;
    }
    if (state.rootOnly && category.in_root !== 1) {
      return;
    }
    const latest = series[series.length - 1];
    if (!latest) {
      return;
    }
    if (usesConfidence(state.metric) && state.confidenceThreshold !== null) {
      const confidence = numericValue(latest, 'cf_d');
      if (confidence === null || confidence < state.confidenceThreshold) {
        return;
      }
    }
    rows.push({
      tld,
      row: latest,
      category,
      price: indexes?.pricesByTld.get(tld) ?? null,
      firstPeriod: series[0].period,
      lastPeriod: latest.period,
      months: series.length,
      value: numericValue(latest, field),
    });
  });

  return rows;
}

function sortRanking(rows: LatestRow[]): LatestRow[] {
  return [...rows].sort((a, b) => compareMetricDesc(a.value, b.value) || a.tld.localeCompare(b.tld));
}

function sortPicked(tlds: string[], state: Controls): string[] {
  if (!indexes) {
    return tlds.sort();
  }
  const field = getField(state.metric, state.halfLife);
  const grouped = indexes.rowsByTld[state.dataset];
  return [...tlds].sort((a, b) => {
    const aRows = grouped.get(a);
    const bRows = grouped.get(b);
    const aValue = aRows ? numericValue(aRows[aRows.length - 1], field) : null;
    const bValue = bRows ? numericValue(bRows[bRows.length - 1], field) : null;
    return compareMetricDesc(aValue, bValue) || a.localeCompare(b);
  });
}

function compareMetricDesc(a: number | null, b: number | null): number {
  if (a === null && b === null) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }
  return b - a;
}

function reconcileManualSelection(availableTlds: string[]): number {
  const available = new Set(availableTlds);
  const before = manualSelected.size;
  manualSelected.forEach((tld) => {
    if (!available.has(tld)) {
      manualSelected.delete(tld);
    }
  });
  return before - manualSelected.size;
}

function renderSummary(target: HTMLElement, manifest: Manifest, state: Controls): void {
  const coverage = manifest.coverage[state.dataset];
  const files = Object.values(manifest.files);
  const rawBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  const gzipBytes = files.reduce((sum, file) => sum + file.gzipBytes, 0);
  const parts = [
    `Snapshot ${manifest.snapshotId}`,
    `${state.dataset.toUpperCase()} ${coverage.minPeriod ?? 'N/A'} to ${coverage.maxPeriod ?? 'N/A'}`,
    `${integerFormat.format(coverage.tldCount)} TLDs`,
    `${formatBytes(rawBytes)} raw / ${formatBytes(gzipBytes)} gzip`,
    `prices ${manifest.priceSnapshotDate}`,
  ];
  target.innerHTML = parts.map((part) => `<span>${escapeHtml(part)}</span>`).join('');
}

function renderTldSelect(controls: ReturnType<typeof collectElements>, availableTlds: string[]): void {
  const search = controls.tldSearch.value.trim().toLowerCase();
  const shown = availableTlds.filter((tld) => !search || tld.includes(search));
  controls.tldSelect.innerHTML = '';
  shown.forEach((tld) => {
    const option = document.createElement('option');
    option.value = tld;
    option.textContent = `.${tld}`;
    option.selected = manualSelected.has(tld);
    controls.tldSelect.append(option);
  });
  controls.tldSelect.disabled = availableTlds.length === 0;
}

function renderSelectionNote(
  controls: ReturnType<typeof collectElements>,
  removed: number,
  picked: string[],
  state: Controls,
): void {
  if (removed > 0) {
    controls.selectionNote.textContent = `${removed} manual selection${removed === 1 ? '' : 's'} cleared because filters made them unavailable.`;
    return;
  }
  if (picked.length === 0 && state.autoPick) {
    controls.selectionNote.textContent = 'No TLDs match the current filters.';
    return;
  }
  if (picked.length === 0) {
    controls.selectionNote.textContent = 'Manual selection is empty and auto-pick is off.';
    return;
  }
  controls.selectionNote.textContent = manualSelected.size > 0
    ? `${picked.length} manually selected TLD${picked.length === 1 ? '' : 's'} shown.`
    : `Auto-picked top ${picked.length} TLD${picked.length === 1 ? '' : 's'} after filters.`;
}

function renderChart(controls: ReturnType<typeof collectElements>, picked: string[], state: Controls): void {
  if (!indexes || picked.length === 0) {
    clearChart(controls, 'No time series to plot for the current selection.');
    return;
  }

  const field = getField(state.metric, state.halfLife);
  const grouped = indexes.rowsByTld[state.dataset];
  const series = picked
    .map((tld) => ({ tld, rows: grouped.get(tld) ?? [] }))
    .filter((entry) => entry.rows.length > 0);
  const values = series.flatMap((entry) => (
    entry.rows
      .map((row) => numericValue(row, field))
      .filter((value): value is number => value !== null)
  ));

  if (series.length === 0 || values.length === 0) {
    clearChart(controls, 'The selected metric has no numeric values for the current TLDs.');
    return;
  }

  controls.chartEmpty.hidden = true;
  controls.chartSvg.innerHTML = '';
  controls.chartTooltip.hidden = true;

  const svg = controls.chartSvg;
  const width = 960;
  const height = 380;
  const margin = { top: 24, right: 28, bottom: 48, left: 76 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const allPeriods = Array.from(new Set(series.flatMap((entry) => entry.rows.map((row) => row.period)))).sort();
  const xIndexes = allPeriods.map(periodIndex);
  const xMin = Math.min(...xIndexes);
  const xMax = Math.max(...xIndexes);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const yMin = state.metric.kind === 'rate' || state.metric.kind === 'count' ? Math.min(0, rawMin) : rawMin;
  const yMax = rawMin === rawMax ? rawMax + 1 : rawMax;
  const yFloor = rawMin === rawMax ? rawMin - 1 : yMin;
  const chartPoints: ChartPoint[] = [];

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${state.metric.label} time series for selected TLDs`);

  drawGrid(svg, width, height, margin, plotWidth, plotHeight, yFloor, yMax, allPeriods);

  series.forEach((entry, index) => {
    const color = COLORS[index % COLORS.length];
    const points: ChartPoint[] = [];
    entry.rows.forEach((row) => {
      const value = numericValue(row, field);
      if (value === null) {
        return;
      }
      const point = {
        tld: entry.tld,
        period: row.period,
        value,
        x: xPosition(periodIndex(row.period), xMin, xMax, margin.left, plotWidth),
        y: yPosition(value, yFloor, yMax, margin.top, plotHeight),
        color,
      };
      points.push(point);
      chartPoints.push(point);
    });
    appendPath(svg, points, color);
    appendPoints(svg, points);
  });

  renderLegend(controls.legend, series.map((entry, index) => ({
    tld: entry.tld,
    color: COLORS[index % COLORS.length],
  })));
  wireTooltip(controls, chartPoints, width, height);
}

function clearChart(controls: ReturnType<typeof collectElements>, message: string): void {
  controls.chartSvg.innerHTML = '';
  controls.legend.innerHTML = '';
  controls.chartTooltip.hidden = true;
  controls.chartEmpty.hidden = false;
  controls.chartEmpty.textContent = message;
}

function drawGrid(
  svg: SVGSVGElement,
  width: number,
  height: number,
  margin: { top: number; right: number; bottom: number; left: number },
  plotWidth: number,
  plotHeight: number,
  yMin: number,
  yMax: number,
  periods: string[],
): void {
  const axisColor = 'var(--color-border)';
  appendSvg(svg, 'rect', {
    x: String(margin.left),
    y: String(margin.top),
    width: String(plotWidth),
    height: String(plotHeight),
    fill: 'transparent',
    stroke: axisColor,
  });

  for (let i = 0; i <= 4; i += 1) {
    const value = yMin + ((yMax - yMin) * i) / 4;
    const y = yPosition(value, yMin, yMax, margin.top, plotHeight);
    appendSvg(svg, 'line', {
      x1: String(margin.left),
      x2: String(width - margin.right),
      y1: String(y),
      y2: String(y),
      stroke: axisColor,
      'stroke-dasharray': i === 0 ? '0' : '4 6',
    });
    const label = appendSvg(svg, 'text', {
      x: String(margin.left - 12),
      y: String(y + 4),
      'text-anchor': 'end',
      class: 'chart-axis-label',
    });
    label.textContent = formatAxisNumber(value);
  }

  const labelPeriods = pickPeriodLabels(periods, 6);
  labelPeriods.forEach((period) => {
    const x = xPosition(periodIndex(period), periodIndex(periods[0]), periodIndex(periods[periods.length - 1]), margin.left, plotWidth);
    appendSvg(svg, 'line', {
      x1: String(x),
      x2: String(x),
      y1: String(margin.top),
      y2: String(height - margin.bottom),
      stroke: axisColor,
      'stroke-dasharray': '2 8',
      opacity: '0.65',
    });
    const label = appendSvg(svg, 'text', {
      x: String(x),
      y: String(height - 16),
      'text-anchor': 'middle',
      class: 'chart-axis-label',
    });
    label.textContent = period;
  });
}

function appendPath(svg: SVGSVGElement, points: ChartPoint[], color: string): void {
  if (points.length === 0) {
    return;
  }
  const d = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
  appendSvg(svg, 'path', {
    d,
    fill: 'none',
    stroke: color,
    'stroke-width': '2.25',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
}

function appendPoints(svg: SVGSVGElement, points: ChartPoint[]): void {
  points.forEach((point) => {
    appendSvg(svg, 'circle', {
      cx: String(point.x),
      cy: String(point.y),
      r: '2.7',
      fill: point.color,
      opacity: '0.86',
    });
  });
}

function appendSvg<K extends keyof SVGElementTagNameMap>(
  parent: SVGElement,
  name: K,
  attrs: Record<string, string>,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  parent.append(element);
  return element;
}

function wireTooltip(
  controls: ReturnType<typeof collectElements>,
  points: ChartPoint[],
  width: number,
  height: number,
): void {
  const svg = controls.chartSvg;
  svg.onmousemove = (event: MouseEvent) => {
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const y = ((event.clientY - rect.top) / rect.height) * height;
    const nearest = findNearestPoint(points, x, y);
    if (!nearest || nearest.distance > 1200) {
      controls.chartTooltip.hidden = true;
      return;
    }
    const point = nearest.point;
    controls.chartTooltip.hidden = false;
    controls.chartTooltip.style.left = `${Math.min(rect.width - 180, Math.max(8, (point.x / width) * rect.width + 12))}px`;
    controls.chartTooltip.style.top = `${Math.max(8, (point.y / height) * rect.height - 20)}px`;
    controls.chartTooltip.innerHTML = `<strong>.${escapeHtml(point.tld)}</strong><span>${escapeHtml(point.period)}</span><span>${formatNumber(point.value)}</span>`;
  };
  svg.onmouseleave = () => {
    controls.chartTooltip.hidden = true;
  };
}

function findNearestPoint(points: ChartPoint[], x: number, y: number): { point: ChartPoint; distance: number } | null {
  let nearest: { point: ChartPoint; distance: number } | null = null;
  points.forEach((point) => {
    const dx = point.x - x;
    const dy = point.y - y;
    const distance = dx * dx + dy * dy;
    if (!nearest || distance < nearest.distance) {
      nearest = { point, distance };
    }
  });
  return nearest;
}

function renderLegend(target: HTMLElement, items: { tld: string; color: string }[]): void {
  target.innerHTML = items.map((item) => (
    `<span class="legend-item"><span class="legend-swatch" style="background:${item.color}"></span>.${escapeHtml(item.tld)}</span>`
  )).join('');
}

function renderRanking(controls: ReturnType<typeof collectElements>, rows: LatestRow[], state: Controls): void {
  controls.rankingCount.textContent = `${rows.length} row${rows.length === 1 ? '' : 's'}`;
  if (rows.length === 0) {
    controls.rankingTable.innerHTML = '<p class="empty-copy">No ranking rows match the current filters.</p>';
    return;
  }

  const columns = state.dataset === 'cic'
    ? cicColumns(state)
    : surblColumns(state);
  const header = columns.map((column) => `<th scope="col">${escapeHtml(column.label)}</th>`).join('');
  const body = rows.map((row, index) => (
    `<tr>${columns.map((column) => `<td>${column.render(row, index)}</td>`).join('')}</tr>`
  )).join('');
  controls.rankingTable.innerHTML = `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
}

function cicColumns(state: Controls): { label: string; render: (row: LatestRow, index: number) => string }[] {
  const field = getField(state.metric, state.halfLife);
  return [
    { label: '#', render: (_row, index) => String(index + 1) },
    { label: 'TLD', render: (row) => `<strong>.${escapeHtml(row.tld)}</strong>` },
    { label: 'Category', render: (row) => escapeHtml(formatCategory(row.category.category)) },
    { label: 'Period', render: (row) => escapeHtml(row.lastPeriod) },
    { label: state.metric.shortLabel, render: (row) => formatMetric(row.row, field) },
    { label: 'Sum rate', render: (row) => formatMetric(row.row, 'sumBadBps') },
    { label: 'Max rate', render: (row) => formatMetric(row.row, 'maxBadBps') },
    { label: 'cf_d', render: (row) => formatMetric(row.row, 'cf_d') },
    { label: 'DUM', render: (row) => formatMetric(row.row, 'tld_dum', true) },
    { label: 'Agg', render: (row) => formatMetric(row.row, 'aggCnt', true) },
    { label: 'Months', render: (row) => String(row.months) },
    { label: 'First', render: (row) => escapeHtml(row.firstPeriod) },
    { label: 'Reg', render: (row) => formatPrice(row.price, 'reg_price', 'reg_currency') },
    { label: 'Renew', render: (row) => formatPrice(row.price, 'renew_price', 'renew_currency') },
    { label: 'Transfer', render: (row) => formatPrice(row.price, 'transfer_price', 'transfer_currency') },
  ];
}

function surblColumns(state: Controls): { label: string; render: (row: LatestRow, index: number) => string }[] {
  const field = getField(state.metric, state.halfLife);
  return [
    { label: '#', render: (_row, index) => String(index + 1) },
    { label: 'TLD', render: (row) => `<strong>.${escapeHtml(row.tld)}</strong>` },
    { label: 'Category', render: (row) => escapeHtml(formatCategory(row.category.category)) },
    { label: 'Period', render: (row) => escapeHtml(row.lastPeriod) },
    { label: state.metric.shortLabel, render: (row) => formatMetric(row.row, field) },
    { label: 'Bad domains', render: (row) => formatMetric(row.row, 'badDomains', true) },
    { label: 'Rate', render: (row) => formatMetric(row.row, 'badBps') },
    { label: 'cf_d', render: (row) => formatMetric(row.row, 'cf_d') },
    { label: 'DUM', render: (row) => formatMetric(row.row, 'tld_dum', true) },
    { label: 'Months', render: (row) => String(row.months) },
    { label: 'First', render: (row) => escapeHtml(row.firstPeriod) },
    { label: 'Reg', render: (row) => formatPrice(row.price, 'reg_price', 'reg_currency') },
    { label: 'Renew', render: (row) => formatPrice(row.price, 'renew_price', 'renew_currency') },
    { label: 'Transfer', render: (row) => formatPrice(row.price, 'transfer_price', 'transfer_currency') },
  ];
}

function numericValue(row: DataRow, field: string): number | null {
  const value = row[field];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function usesConfidence(metric: MetricOption): boolean {
  return metric.kind === 'velocity' || metric.kind === 'acceleration';
}

function periodIndex(period: string): number {
  const [year, month] = period.split('-').map((part) => Number.parseInt(part, 10));
  return year * 12 + month - 1;
}

function xPosition(value: number, min: number, max: number, left: number, width: number): number {
  if (min === max) {
    return left + width / 2;
  }
  return left + ((value - min) / (max - min)) * width;
}

function yPosition(value: number, min: number, max: number, top: number, height: number): number {
  if (min === max) {
    return top + height / 2;
  }
  return top + height - ((value - min) / (max - min)) * height;
}

function pickPeriodLabels(periods: string[], count: number): string[] {
  if (periods.length <= count) {
    return periods;
  }
  const labels = new Set<string>();
  for (let i = 0; i < count; i += 1) {
    labels.add(periods[Math.round((i * (periods.length - 1)) / (count - 1))]);
  }
  return Array.from(labels).sort();
}

function formatMetric(row: DataRow, field: string, integer = false): string {
  const value = numericValue(row, field);
  if (value === null) {
    return '<span class="muted">N/A</span>';
  }
  return escapeHtml(integer ? integerFormat.format(value) : formatNumber(value));
}

function formatNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return integerFormat.format(value);
  }
  if (abs < 1 && abs > 0) {
    return preciseFormat.format(value);
  }
  return numberFormat.format(value);
}

function formatAxisNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return `${numberFormat.format(value / 1000)}k`;
  }
  return formatNumber(value);
}

function formatPrice(row: PriceRow | null, priceField: string, currencyField: string): string {
  if (!row) {
    return '<span class="muted">N/A</span>';
  }
  const price = row[priceField];
  const currency = row[currencyField];
  if (typeof price !== 'number' || !Number.isFinite(price)) {
    return '<span class="muted">N/A</span>';
  }
  const formatted = numberFormat.format(price);
  if (currency === '$') {
    return `$${formatted}`;
  }
  if (typeof currency === 'string' && currency.length > 0) {
    return `${formatted} ${escapeHtml(currency)}`;
  }
  return formatted;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${numberFormat.format(bytes / (1024 * 1024))} MB`;
  }
  if (bytes >= 1024) {
    return `${numberFormat.format(bytes / 1024)} KB`;
  }
  return `${integerFormat.format(bytes)} B`;
}

function formatCategory(value: string): string {
  if (value === 'new_gtld') {
    return 'new gTLD';
  }
  if (value === 'cctld') {
    return 'ccTLD';
  }
  if (value === 'grandfathered_gtld') {
    return 'grandfathered gTLD';
  }
  return value.replaceAll('_', ' ');
}

function setLoading(root: HTMLElement, loading: boolean): void {
  root.classList.toggle('is-loading', loading);
  const status = root.querySelector<HTMLElement>('[data-status]');
  if (status) {
    status.textContent = loading ? 'Loading snapshot...' : '';
  }
}

function showLoadError(root: HTMLElement, error: Error): void {
  const status = root.querySelector<HTMLElement>('[data-status]');
  if (status) {
    status.textContent = error.message;
  }
  root.classList.add('has-error');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTldDashboard, { once: true });
} else {
  initTldDashboard();
}

document.addEventListener('astro:page-load', initTldDashboard);
