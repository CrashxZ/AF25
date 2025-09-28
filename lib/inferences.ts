// lib/inferences.ts
// Basic inference rules for UE health/status.

export type Severity = "info" | "warning" | "alert";

export type Inference = {
  code: string;
  title: string;
  message: string;
  severity: Severity;
};

type UE = {
  pci: number;
  rnti: number;
  downlink: {
    cqi: number;
    ri: number;
    mcs: number;
    bitrate: number; // bps
    packets_ok: number;
    packets_nok: number;
    drop_rate: number; // %
    buffer_status: number; // bytes
  };
  uplink: {
    pusch_sinr: number;
    rsrp: number;
    ri: number;
    mcs: number;
    bitrate: number; // bps
    packets_ok: number;
    packets_nok: number;
    drop_rate: number; // %
    bsr: number; // bytes
    timing_advance: number;
    phr: number;
  };
};

// Simple linear regression slope helper (per-sample).
function slope(series: number[]): number {
  const n = series.length;
  if (n < 3) return 0;
  const xs = Array.from({ length: n }, (_, i) => i);
  const meanX = (n - 1) / 2;
  const meanY = series.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    num += dx * (series[i] - meanY);
    den += dx * dx;
  }
  return den === 0 ? 0 : num / den;
}

function lastN<T>(arr: T[], n: number): T[] {
  return arr.slice(Math.max(0, arr.length - n));
}

// Build message helpers.
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtMbps = (bps: number) => `${(bps / 1e6).toFixed(2)} Mbps`;

/**
 * Evaluate rules against current UE + short history.
 * History is a list of recent UE snapshots (oldest->newest). Use ~10 samples if available.
 */
export function evaluateUEInferences(ue: UE, history: UE[]): Inference[] {
  const inferences: Inference[] = [];

  // --- Rule 1: Drop rate high (DL/UL) ---
  const dlDrop = ue.downlink.drop_rate ?? 0;
  const ulDrop = ue.uplink.drop_rate ?? 0;

  if (dlDrop > 10) {
    inferences.push({
      code: "dl_drops_alert",
      title: "High DL drop rate",
      message: `Downlink drop rate is ${fmtPct(dlDrop)} (>10%).`,
      severity: "alert"
    });
  } else if (dlDrop > 5) {
    inferences.push({
      code: "dl_drops_warn",
      title: "Elevated DL drop rate",
      message: `Downlink drop rate is ${fmtPct(dlDrop)} (>5%).`,
      severity: "warning"
    });
  }

  if (ulDrop > 10) {
    inferences.push({
      code: "ul_drops_alert",
      title: "High UL drop rate",
      message: `Uplink drop rate is ${fmtPct(ulDrop)} (>10%).`,
      severity: "alert"
    });
  } else if (ulDrop > 5) {
    inferences.push({
      code: "ul_drops_warn",
      title: "Elevated UL drop rate",
      message: `Uplink drop rate is ${fmtPct(ulDrop)} (>5%).`,
      severity: "warning"
    });
  }

  // --- Rule 2: Low CQI (poor channel) ---
  const cqi = ue.downlink.cqi ?? 0;
  if (cqi < 4) {
    inferences.push({
      code: "cqi_very_low",
      title: "Poor channel quality",
      message: `CQI=${cqi} (<4).`,
      severity: "alert"
    });
  } else if (cqi < 7) {
    inferences.push({
      code: "cqi_low",
      title: "Low channel quality",
      message: `CQI=${cqi} (<7).`,
      severity: "warning"
    });
  }

  // --- Rule 3: Negative bitrate trends (DL/UL) ---
  // Use last 10 samples; slope threshold tuned for mock stream @ ~3s cadence.
  const window = 10;
  const recent = lastN(history, window);
  if (recent.length >= 3) {
    const dlSeries = recent.map((u) => u.downlink.bitrate / 1e6); // Mbps
    const ulSeries = recent.map((u) => u.uplink.bitrate / 1e6); // Mbps
    const sDl = slope(dlSeries); // Mbps per sample (~3s)
    const sUl = slope(ulSeries);

    // Thresholds: warning if < -0.3 Mbps/sample, alert if < -0.7 Mbps/sample.
    if (sDl < -0.7) {
      inferences.push({
        code: "dl_bitrate_trend_alert",
        title: "Downlink throughput dropping",
        message: `DL trend falling fast (${sDl.toFixed(2)} Mbps/sample). Current ${fmtMbps(
          ue.downlink.bitrate
        )}.`,
        severity: "alert"
      });
    } else if (sDl < -0.3) {
      inferences.push({
        code: "dl_bitrate_trend_warn",
        title: "Downlink throughput decreasing",
        message: `DL trend is negative (${sDl.toFixed(2)} Mbps/sample).`,
        severity: "warning"
      });
    }

    if (sUl < -0.7) {
      inferences.push({
        code: "ul_bitrate_trend_alert",
        title: "Uplink throughput dropping",
        message: `UL trend falling fast (${sUl.toFixed(2)} Mbps/sample). Current ${fmtMbps(
          ue.uplink.bitrate
        )}.`,
        severity: "alert"
      });
    } else if (sUl < -0.3) {
      inferences.push({
        code: "ul_bitrate_trend_warn",
        title: "Uplink throughput decreasing",
        message: `UL trend is negative (${sUl.toFixed(2)} Mbps/sample).`,
        severity: "warning"
      });
    }
  }

  // --- Optional signal: Large buffer/BSR accumulation (congestion hint) ---
  if (ue.downlink.buffer_status > 40000) {
    inferences.push({
      code: "dl_buffer_high",
      title: "DL buffer building up",
      message: `Buffer status ${ue.downlink.buffer_status.toLocaleString()} bytes.`,
      severity: "info"
    });
  }
  if (ue.uplink.bsr > 35000) {
    inferences.push({
      code: "ul_bsr_high",
      title: "UL BSR high",
      message: `BSR ${ue.uplink.bsr.toLocaleString()} bytes.`,
      severity: "info"
    });
  }

  // If nothing triggered, surface a healthy info.
  if (inferences.length === 0) {
    inferences.push({
      code: "healthy",
      title: "No issues detected",
      message: "KPIs within nominal ranges.",
      severity: "info"
    });
  }

  return inferences;
}