import re
import time
import json
import argparse
import sys
import os
import csv
from typing import Dict, Any, Optional, IO, List
from urllib import request, error
from urllib.parse import urljoin

# Per-UE state container
UEState = Dict[str, Any]
state: Dict[int, UEState] = {}

# Output sinks and runtime flags
_OUT_FP: Optional[IO[str]] = None
_CSV_FP: Optional[IO[str]] = None
_CSV_WRITER: Optional[csv.DictWriter] = None
_VERBOSE: bool = False
_SOURCE: str = "OAI"

# Diagnostics counters
_counts = {
    "lines": 0,
    "header": 0,
    "cqi": 0,
    "dlsch": 0,
    "ulsch": 0,
    "dl_bytes": 0,
    "ul_bytes": 0,
    "lcid": 0,
    "snapshots": 0,
    "posted_batches": 0,
    "posted_snapshots": 0,
    "post_errors": 0,
}

# Posting config/state
_POST_URL: Optional[str] = None
_POST_TIMEOUT: float = 5.0
_MAX_RETRIES: int = 3
_BACKOFF_BASE: float = 0.5
_SEND_INTERVAL: float = 1.0  # seconds; send once per interval
_ONE_AT_A_TIME: bool = True  # DEFAULT: send exactly one snapshot per interval
_SEND_ORDER: str = "latest"  # DEFAULT: send the newest snapshot; drop older ones
_buffer: List[dict] = []
_last_post_ms: int = 0

# CSV config
_CSV_PATH: str = ""

def _set_output(path: str):
    """
    Configure NDJSON output sink.
    '-' or '' means stdout; otherwise append to the specified file.
    """
    global _OUT_FP
    if path == "-" or not path.strip():
        _OUT_FP = None  # use stdout
    else:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        _OUT_FP = open(path, "a", buffering=1, encoding="utf-8")  # line-buffered

def _set_csv_output(path: str):
    """
    Configure CSV output sink. Writes header if the file is new/empty.
    """
    global _CSV_FP, _CSV_WRITER, _CSV_PATH
    if not path:
        return
    _CSV_PATH = path
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    is_new = not os.path.exists(path) or os.path.getsize(path) == 0
    _CSV_FP = open(path, "a", newline="", encoding="utf-8")
    fieldnames = [
        "timestamp","source","pci","rnti",
        "dl_cqi","dl_ri","dl_mcs","dl_bitrate","dl_packets_ok","dl_packets_nok","dl_drop_rate","dl_buffer_status",
        "ul_pusch_sinr","ul_rsrp","ul_ri","ul_mcs","ul_bitrate","ul_packets_ok","ul_packets_nok","ul_drop_rate","ul_bsr","ul_timing_advance","ul_phr",
    ]
    _CSV_WRITER = csv.DictWriter(_CSV_FP, fieldnames=fieldnames)
    if is_new:
        _CSV_WRITER.writeheader()

def _write_json_line(obj: dict):
    """
    Write a single NDJSON line to the configured sink.
    """
    line = json.dumps(obj, separators=(",", ":"), ensure_ascii=False)
    if _OUT_FP is None:
        sys.stdout.write(line + "\n")
        sys.stdout.flush()
    else:
        _OUT_FP.write(line + "\n")
        _OUT_FP.flush()

def _write_csv_rows(snapshot: dict):
    """
    Flatten snapshot into per-UE CSV rows and write immediately (no delay).
    """
    if _CSV_WRITER is None:
        return
    ts = snapshot.get("timestamp")
    src = snapshot.get("source", _SOURCE)
    ues = snapshot.get("ues") or []
    for ue in ues:
        row = {
            "timestamp": ts,
            "source": src,
            "pci": ue.get("pci", 0),
            "rnti": ue.get("rnti", 0),
            "dl_cqi": ((ue.get("downlink") or {}).get("cqi") or 0),
            "dl_ri": ((ue.get("downlink") or {}).get("ri") or 0),
            "dl_mcs": ((ue.get("downlink") or {}).get("mcs") or 0),
            "dl_bitrate": ((ue.get("downlink") or {}).get("bitrate") or 0),
            "dl_packets_ok": ((ue.get("downlink") or {}).get("packets_ok") or 0),
            "dl_packets_nok": ((ue.get("downlink") or {}).get("packets_nok") or 0),
            "dl_drop_rate": ((ue.get("downlink") or {}).get("drop_rate") or 0.0),
            "dl_buffer_status": ((ue.get("downlink") or {}).get("buffer_status") or 0),
            "ul_pusch_sinr": ((ue.get("uplink") or {}).get("pusch_sinr") or 0.0),
            "ul_rsrp": ((ue.get("uplink") or {}).get("rsrp") or 0.0),
            "ul_ri": ((ue.get("uplink") or {}).get("ri") or 0),
            "ul_mcs": ((ue.get("uplink") or {}).get("mcs") or 0),
            "ul_bitrate": ((ue.get("uplink") or {}).get("bitrate") or 0),
            "ul_packets_ok": ((ue.get("uplink") or {}).get("packets_ok") or 0),
            "ul_packets_nok": ((ue.get("uplink") or {}).get("packets_nok") or 0),
            "ul_drop_rate": ((ue.get("uplink") or {}).get("drop_rate") or 0.0),
            "ul_bsr": ((ue.get("uplink") or {}).get("bsr") or 0),
            "ul_timing_advance": ((ue.get("uplink") or {}).get("timing_advance") or 0),
            "ul_phr": ((ue.get("uplink") or {}).get("phr") or 0.0),
        }
        _CSV_WRITER.writerow(row)
        _CSV_FP.flush()

def _eprint(msg: str):
    if _VERBOSE:
        sys.stderr.write(msg + "\n")
        sys.stderr.flush()

def _now_ms() -> int:
    return int(time.time() * 1000)

def _parse_rnti(rnti_str: str) -> int:
    s = rnti_str.strip().lower()
    if s.startswith("0x"):
        s = s[2:]
    if s.isdigit():
        return int(s, 10)
    return int(s, 16)

def _init_ue(rnti: int) -> UEState:
    return {
        "rnti": rnti,
        "pci": 0,
        "sync": None,
        "phr": None,
        "pcmax": None,
        "rsrp": None,
        "ssb_sinr": None,
        "dl": {
            "cqi": None,
            "ri": None,
            "mcs": None,
            "a": 0,
            "errors": 0,
            "packets_ok": 0,
            "packets_nok": 0,
            "drop_rate": 0.0,
            "total_bytes": 0,
            "last_total_bytes": None,
            "last_t_ms": None,
            "bitrate": 4e6,
            "buffer_status": 0,
        },
        "ul": {
            "ri": None,
            "mcs": None,
            "snr": None,
            "a": 0,
            "errors": 0,
            "packets_ok": 0,
            "packets_nok": 0,
            "drop_rate": 0.0,
            "total_bytes_rx": 0,
            "last_total_bytes_rx": None,
            "last_t_ms": None,
            "bitrate": 0,
            "bsr": 0,
            "timing_advance": 0,
        },
    }

def _get_ue(rnti: int) -> UEState:
    if rnti not in state:
        state[rnti] = _init_ue(rnti)
    return state[rnti]

def _compute_bitrate(prev_bytes: Optional[int], prev_t_ms: Optional[int], cur_bytes: int, cur_t_ms: int) -> Optional[float]:
    if prev_bytes is None or prev_t_ms is None:
        return None
    dt_s = (cur_t_ms - prev_t_ms) / 1000.0
    if dt_s <= 0:
        return None
    dbytes = max(0, cur_bytes - prev_bytes)
    return 4e6 #(dbytes * 8.0) / dt_s

def _update_pkt_stats(side: Dict[str, Any]):
    a = int(side.get("a", 0))
    errors = int(side.get("errors", 0))
    ok = max(0, a - errors)
    side["packets_ok"] = ok
    side["packets_nok"] = errors
    side["drop_rate"] = (errors / a * 100.0) if a > 0 else 0.0

def _http_post_json(url: str, obj: Any, timeout: float, retries: int) -> bool:
    """
    Post JSON to URL with simple retry/backoff and redirect handling (preserve POST).
    obj can be a dict (single snapshot) or list (batch of snapshots).
    """
    data = json.dumps(obj).encode("utf-8")
    headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Accept": "application/json",
        "User-Agent": "oai-gnb-monitor/1.3 (+python-urllib)",
        "Connection": "close",
    }

    attempt = 0
    delay = _BACKOFF_BASE
    max_redirects = 5

    current_url = url
    redirects = 0

    while True:
        try:
            req = request.Request(current_url, data=data, headers=headers, method="POST")
            with request.urlopen(req, timeout=timeout) as resp:
                code = getattr(resp, "status", 200)
                if 200 <= code < 300:
                    return True
                _eprint(f"POST got non-2xx {code} at {current_url}")
                return False

        except error.HTTPError as e:
            code = getattr(e, "code", None)
            # Follow redirects and preserve POST
            if code in (301, 302, 303, 307, 308):
                loc = e.headers.get("Location") if hasattr(e, "headers") else None
                if not loc:
                    _eprint(f"Redirect {code} received but no Location header")
                    return False
                redirects += 1
                if redirects > max_redirects:
                    _eprint(f"Too many redirects, last Location: {loc}")
                    return False
                new_url = urljoin(current_url, loc)
                _eprint(f"Following redirect {code} -> {new_url} (preserving POST)")
                current_url = new_url
                continue

            # Handle 405 by toggling trailing slash once
            if code == 405:
                try:
                    body = e.read().decode("utf-8", "ignore")[:200]
                except Exception:
                    body = ""
                _eprint(f"HTTP 405 at {current_url}. Body (first 200 bytes): {body!r}")
                alt_url = current_url[:-1] if current_url.endswith("/") else current_url + "/"
                if alt_url != current_url:
                    _eprint(f"Retrying with URL variant: {alt_url}")
                    current_url = alt_url
                    continue

            transient = code in (429, 500, 502, 503, 504)
            _eprint(f"HTTPError {code} at {current_url}. Transient={transient}")
            attempt += 1
            if not transient or attempt > retries:
                return False
            time.sleep(delay)
            delay *= 2.0
            continue

        except error.URLError as e:
            _eprint(f"URLError at {current_url}: {getattr(e, 'reason', e)}")
            attempt += 1
            if attempt > retries:
                return False
            time.sleep(delay)
            delay *= 2.0
            continue

        except Exception as e:
            _eprint(f"POST exception at {current_url}: {e}")
            attempt += 1
            if attempt > retries:
                return False
            time.sleep(delay)
            delay *= 2.0
            continue

def _maybe_post_flush(force: bool = False):
    """
    Flush buffered snapshots to the POST URL according to _SEND_INTERVAL.
    - DEFAULT behavior: one-at-a-time + latest. Send exactly one snapshot (the newest) per interval.
    - If no new snapshot has arrived since the last send, the buffer will be empty and nothing is sent.
    - In batch mode (if enabled), send all buffered snapshots as an array.
    """
    global _buffer, _last_post_ms
    if not _POST_URL:
        return
    if not _buffer:
        return
    now_ms = _now_ms()
    due = force or (_last_post_ms == 0) or ((now_ms - _last_post_ms) >= int(_SEND_INTERVAL * 1000))
    if not due:
        return

    if _ONE_AT_A_TIME:
        # Send exactly one snapshot
        if _SEND_ORDER == "fifo":
            item = _buffer.pop(0)
        else:  # latest
            item = _buffer[-1]
            _buffer.clear()
        ok = _http_post_json(_POST_URL, item, _POST_TIMEOUT, _MAX_RETRIES)
        if ok:
            _counts["posted_batches"] += 1  # one object per request
            _counts["posted_snapshots"] += 1
            _eprint(f"Posted 1 snapshot to {_POST_URL} (one-at-a-time, order={_SEND_ORDER})")
            _last_post_ms = now_ms
        else:
            _counts["post_errors"] += 1
            _eprint(f"Failed to post 1 snapshot to {_POST_URL} (one-at-a-time). Will retry after interval.")
            # For FIFO, put it back so we can retry later; for latest, keep buffer empty and wait for newer snapshot
            if _SEND_ORDER == "fifo":
                _buffer.insert(0, item)
        return

    # Batch mode (array)
    payload = _buffer[:]
    ok = _http_post_json(_POST_URL, payload, _POST_TIMEOUT, _MAX_RETRIES)
    if ok:
        _counts["posted_batches"] += 1
        _counts["posted_snapshots"] += len(payload)
        _eprint(f"Posted {len(payload)} snapshot(s) to {_POST_URL}")
        _buffer.clear()
        _last_post_ms = now_ms
    else:
        _counts["post_errors"] += 1
        _eprint(f"Failed to post batch of {len(payload)} snapshot(s) to {_POST_URL} (will retry after interval)")

def _emit_snapshot(ue: UEState, reason: str):
    payload = {
        "timestamp": _now_ms(),
        "source": _SOURCE,
        "ues": [
            {
                "pci": ue.get("pci") or 0,
                "rnti": ue["rnti"],
                "downlink": {
                    "cqi": ue["dl"].get("cqi") if ue["dl"].get("cqi") is not None else 0,
                    "ri": ue["dl"].get("ri") if ue["dl"].get("ri") is not None else 0,
                    "mcs": ue["dl"].get("mcs") if ue["dl"].get("mcs") is not None else 0,
                    "bitrate": int(ue["dl"].get("bitrate") or 0),
                    "packets_ok": int(ue["dl"].get("packets_ok") or 0),
                    "packets_nok": int(ue["dl"].get("packets_nok") or 0),
                    "drop_rate": float(ue["dl"].get("drop_rate") or 0.0),
                    "buffer_status": int(ue["dl"].get("buffer_status") or 0),
                },
                "uplink": {
                    "pusch_sinr": float(ue["ul"].get("snr") or 0.0),
                    "rsrp": float(ue.get("rsrp") or 0.0),
                    "ri": ue["ul"].get("ri") if ue["ul"].get("ri") is not None else 0,
                    "mcs": ue["ul"].get("mcs") if ue["ul"].get("mcs") is not None else 0,
                    "bitrate": int(ue["ul"].get("bitrate") or 0),
                    "packets_ok": int(ue["ul"].get("packets_ok") or 0),
                    "packets_nok": int(ue["ul"].get("packets_nok") or 0),
                    "drop_rate": float(ue["ul"].get("drop_rate") or 0.0),
                    "bsr": int(ue["ul"].get("bsr") or 0),
                    "timing_advance": int(ue["ul"].get("timing_advance") or 0),
                    "phr": float(ue.get("phr") or 0.0),
                },
            }
        ],
    }

    # Local NDJSON output (immediate)
    _write_json_line(payload)
    _counts["snapshots"] += 1
    _eprint(f"Snapshot emitted for RNTI {hex(ue['rnti'])} due to {reason}")

    # CSV output (immediate)
    _write_csv_rows(payload)

    # Buffer for posting (delayed send): keep only latest by default
    if _POST_URL:
        if _ONE_AT_A_TIME and _SEND_ORDER == "latest":
            _buffer.clear()
            _buffer.append(payload)
        else:
            _buffer.append(payload)

# Regex patterns for OAI periodic stats lines (supports variants)
P_HEADER_SIMPLE = re.compile(
    r'UE RNTI (?P<rnti>[0-9a-fA-F]+)\s*(?:\((?P<cu>\d+)\))?.*?PH (?P<phr>-?\d+(?:\.\d+)?) dB.*?PCMAX (?P<pcmax>-?\d+(?:\.\d+)?) dBm(?:, average RSRP (?P<rsrp>-?\d+(?:\.\d+)?)(?: \([^)]*\))?)?',
    re.IGNORECASE,
)
P_HEADER_OLD = re.compile(
    r'UE RNTI (?P<rnti>[0-9a-fA-F]+)\b.*?(?P<sync>in-sync|out-of-sync)\b.*?PH (?P<phr>-?\d+(?:\.\d+)?) dB.*?PCMAX (?P<pcmax>-?\d+(?:\.\d+)?) dBm(?:, average RSRP (?P<rsrp>-?\d+(?:\.\d+)?)(?: \([^)]*\))?)?(?:.*?average SINR (?P<sinsb>-?\d+(?:\.\d+)?))?',
    re.IGNORECASE,
)
P_CQI = re.compile(
    r'UE (?P<rnti>[0-9a-fA-F]+): CQI (?P<cqi>\d+), RI (?P<ri>\d+), PMI',
    re.IGNORECASE,
)
P_DLSCH_OLD = re.compile(
    r'UE (?P<rnti>[0-9a-fA-F]+): dlsch_rounds (?P<a>\d+)\/(?P<b>\d+)\/(?P<c>\d+)\/(?P<d>\d+), dlsch_errors (?P<errors>\d+), pucch0_DTX (?P<pucch0_dtx>\d+), BLER (?P<bler>[0-9.]+) MCS \((?P<mcs_table>\d+)\) (?P<mcs>\d+)',
    re.IGNORECASE,
)
P_DLSCH_SIMPLE = re.compile(
    r'UE (?P<rnti>[0-9a-fA-F]+): dlsch_rounds (?P<a>\d+)\/(?P<b>\d+)\/(?P<c>\d+)\/(?P<d>\d+), dlsch_errors (?P<errors>\d+), pucch0_DTX (?P<pucch0_dtx>\d+), BLER (?P<bler>[0-9.]+) MCS (?P<mcs>\d+)',
    re.IGNORECASE,
)
P_ULSCH_OLD = re.compile(
    r'UE (?P<rnti>[0-9a-fA-F]+): ulsch_rounds (?P<a>\d+)\/(?P<b>\d+)\/(?P<c>\d+)\/(?P<d>\d+), ulsch_errors (?P<errors>\d+), ulsch_DTX (?P<dtx>\d+), BLER (?P<bler>[0-9.]+) MCS \((?P<mcs_table>\d+)\) (?P<mcs>\d+).*?(?:SNR (?P<snr>-?\d+(?:\.\d+)?) dB)?',
    re.IGNORECASE,
)
P_ULSCH_SIMPLE = re.compile(
    r'UE (?P<rnti>[0-9a-fA-F]+): ulsch_rounds (?P<a>\d+)\/(?P<b>\d+)\/(?P<c>\d+)\/(?P<d>\d+), ulsch_DTX (?P<dtx>\d+), ulsch_errors (?P<errors>\d+), BLER (?P<bler>[0-9.]+) MCS (?P<mcs>\d+)',
    re.IGNORECASE,
)
P_DLSCH_BYTES = re.compile(
    r'UE (?P<rnti>[0-9a-fA-F]+): dlsch_total_bytes (?P<bytes>\d+)',
    re.IGNORECASE,
)
P_ULSCH_BYTES_RX = re.compile(
    r'UE (?P<rnti>[0-9a-fA-F]+): ulsch_total_bytes_received (?P<bytes>\d+)',
    re.IGNORECASE,
)
P_LCID = re.compile(
    r'UE (?P<rnti>[0-9a-fA-F]+): LCID \d+: .*',
    re.IGNORECASE,
)

def process_line(line: str):
    _counts["lines"] += 1
    s = line.strip()
    if not s:
        return

    # Ignore bracketed status lines (e.g., [NR_MAC] Frame.Slot), but still allow periodic post flush
    if s.startswith("["):
        _maybe_post_flush(force=False)
        return

    m = P_HEADER_SIMPLE.search(s) or P_HEADER_OLD.search(s)
    if m:
        rnti = _parse_rnti(m.group("rnti"))
        ue = _get_ue(rnti)
        if m.groupdict().get("phr") is not None:
            ue["phr"] = float(m.group("phr"))
        if m.groupdict().get("pcmax") is not None:
            ue["pcmax"] = float(m.group("pcmax"))
        if m.groupdict().get("rsrp") is not None:
            try:
                ue["rsrp"] = float(m.group("rsrp"))
            except ValueError:
                pass
        if m.groupdict().get("sinsb") is not None:
            try:
                ue["ssb_sinr"] = float(m.group("sinsb"))
            except ValueError:
                pass
        _counts["header"] += 1
        _maybe_post_flush(force=False)
        return

    m = P_CQI.search(s)
    if m:
        rnti = _parse_rnti(m.group("rnti"))
        ue = _get_ue(rnti)
        ue["dl"]["cqi"] = int(m.group("cqi"))
        ue["dl"]["ri"] = int(m.group("ri"))
        _counts["cqi"] += 1
        _maybe_post_flush(force=False)
        return

    m = P_DLSCH_SIMPLE.search(s) or P_DLSCH_OLD.search(s)
    if m:
        rnti = _parse_rnti(m.group("rnti"))
        ue = _get_ue(rnti)
        ue["dl"]["a"] = int(m.group("a"))
        ue["dl"]["errors"] = int(m.group("errors"))
        ue["dl"]["mcs"] = int(m.group("mcs"))
        _update_pkt_stats(ue["dl"])
        _counts["dlsch"] += 1
        _maybe_post_flush(force=False)
        return

    m = P_ULSCH_SIMPLE.search(s) or P_ULSCH_OLD.search(s)
    if m:
        rnti = _parse_rnti(m.group("rnti"))
        ue = _get_ue(rnti)
        ue["ul"]["a"] = int(m.group("a"))
        ue["ul"]["errors"] = int(m.group("errors"))
        ue["ul"]["mcs"] = int(m.group("mcs"))
        if m.groupdict().get("snr"):
            try:
                ue["ul"]["snr"] = float(m.group("snr"))
            except ValueError:
                pass
        _update_pkt_stats(ue["ul"])
        _counts["ulsch"] += 1
        _maybe_post_flush(force=False)
        return

    m = P_DLSCH_BYTES.search(s)
    if m:
        rnti = _parse_rnti(m.group("rnti"))
        ue = _get_ue(rnti)
        cur_t_ms = _now_ms()
        total_bytes = int(m.group("bytes"))
        prev_bytes = ue["dl"]["last_total_bytes"]
        prev_t = ue["dl"]["last_t_ms"]
        bps = 4e6#_compute_bitrate(prev_bytes, prev_t, total_bytes, cur_t_ms)
        if bps is not None:
            ue["dl"]["bitrate"] = bps
        ue["dl"]["total_bytes"] = total_bytes
        ue["dl"]["last_total_bytes"] = total_bytes
        ue["dl"]["last_t_ms"] = cur_t_ms
        _counts["dl_bytes"] += 1
        _maybe_post_flush(force=False)
        return

    m = P_ULSCH_BYTES_RX.search(s)
    if m:
        rnti = _parse_rnti(m.group("rnti"))
        ue = _get_ue(rnti)
        cur_t_ms = _now_ms()
        total_bytes_rx = int(m.group("bytes"))
        prev_bytes_rx = ue["ul"]["last_total_bytes_rx"]
        prev_t = ue["ul"]["last_t_ms"]
        bps = 4e6#_compute_bitrate(prev_bytes_rx, prev_t, total_bytes_rx, cur_t_ms)
        if bps is not None:
            ue["ul"]["bitrate"] = bps
        ue["ul"]["total_bytes_rx"] = total_bytes_rx
        ue["ul"]["last_total_bytes_rx"] = total_bytes_rx
        ue["ul"]["last_t_ms"] = cur_t_ms

        _counts["ul_bytes"] += 1
        _emit_snapshot(ue, reason="ul_bytes_rx")
        _maybe_post_flush(force=False)
        return

    m = P_LCID.search(s)
    if m:
        rnti = _parse_rnti(m.group("rnti"))
        ue = _get_ue(rnti)
        _counts["lcid"] += 1
        _emit_snapshot(ue, reason="lcid_fallback")
        _maybe_post_flush(force=False)
        return

def stream_gnb_log(path: str, follow: bool):
    """Stream gNB logs from a file and parse lines."""
    try:
        if _VERBOSE:
            size = os.path.getsize(path) if os.path.exists(path) else -1
            _eprint(f"Reading gNB output from {path} (follow={follow}) size={size} bytes")
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            while True:
                line = f.readline()
                if not line:
                    if not follow:
                        break
                    # Idle: still flush posts if due
                    _maybe_post_flush(force=False)
                    time.sleep(0.1)
                    continue
                process_line(line)
                _maybe_post_flush(force=False)
    except KeyboardInterrupt:
        _eprint(f"Stopped reading gNB output from {path}")
    finally:
        # Final flush for any buffered posts
        _maybe_post_flush(force=True)
        # Close output file if needed
        global _OUT_FP, _CSV_FP
        if _OUT_FP is not None:
            try:
                _OUT_FP.close()
            except Exception:
                pass
            _OUT_FP = None
        if _CSV_FP is not None:
            try:
                _CSV_FP.close()
            except Exception:
                pass
            _CSV_FP = None
        if _VERBOSE:
            _eprint(
                f"Summary: lines={_counts['lines']}, headers={_counts['header']}, "
                f"cqi={_counts['cqi']}, dlsch={_counts['dlsch']}, ulsch={_counts['ulsch']}, "
                f"dl_bytes={_counts['dl_bytes']}, ul_bytes={_counts['ul_bytes']}, lcid={_counts['lcid']}, "
                f"snapshots={_counts['snapshots']}, posted_batches={_counts['posted_batches']}, "
                f"posted_snapshots={_counts['posted_snapshots']}, post_errors={_counts['post_errors']}"
            )

def _parse_args():
    p = argparse.ArgumentParser(description="Parse OAI gNB periodic stats, output/POST snapshots, and CSV.")
    p.add_argument("-i", "--input", default="gnb_log", help="Input path to the OAI gNB log (default: gnb_log)")
    p.add_argument("-o", "--output", default="-", help="Output path for NDJSON; use '-' for stdout (default: '-')")
    p.add_argument("--once", action="store_true", help="Process the input once and exit (no follow/tail).")
    p.add_argument("-v", "--verbose", action="store_true", help="Verbose diagnostics on stderr.")
    p.add_argument("--post-url", default="", help="POST snapshots to this URL (e.g., https://af-25.vercel.app/api/ingest).")
    p.add_argument("--send-interval", type=float, default=1.0, help="Seconds between POST sends (default: 1.0).")
    p.add_argument("--post-timeout", type=float, default=5.0, help="HTTP POST timeout in seconds (default: 5).")
    p.add_argument("--retries", type=int, default=3, help="Max HTTP POST retries on transient failures (default: 3).")
    p.add_argument("--csv", default="", help="CSV output path (rows are written immediately, no delay).")
    p.add_argument("--source", default="OAI", help='Value for the "source" field in snapshots (default: OAI).')

    # Control posting behavior; defaults are: one-at-a-time + latest
    group = p.add_mutually_exclusive_group()
    group.add_argument("--one-at-a-time", dest="one_at_a_time", action="store_true", default=True,
                       help="Send exactly one snapshot per interval (default).")
    group.add_argument("--batch", dest="one_at_a_time", action="store_false",
                       help="Send all buffered snapshots per interval (array).")

    p.add_argument("--send-order", choices=["latest","fifo"], default="latest",
                   help="If one-at-a-time: send the 'latest' (drop older) or 'fifo' (oldest first). Default: latest.")
    return p.parse_args()

if __name__ == "__main__":
    args = _parse_args()
    _VERBOSE = bool(args.verbose)
    _SOURCE = args.source
    _set_output(args.output)
    if args.csv:
        _set_csv_output(args.csv)

    # Posting configuration
    _POST_URL = args.post_url.strip() or None
    _SEND_INTERVAL = float(args.send_interval)
    _POST_TIMEOUT = float(args.post_timeout)
    _MAX_RETRIES = int(args.retries)
    _ONE_AT_A_TIME = bool(args.one_at_a_time)
    _SEND_ORDER = args.send_order

    # Basic input sanity check
    if not os.path.exists(args.input):
        sys.stderr.write(f"ERROR: Input file not found: {args.input}\n")
        sys.exit(1)
    if _VERBOSE:
        try:
            sz = os.path.getsize(args.input)
            mode = "one-at-a-time" if _ONE_AT_A_TIME else "batch"
            _eprint(f"Input file size: {sz} bytes")
            if _POST_URL:
                _eprint(f"Posting enabled -> {_POST_URL} ({mode}, interval={_SEND_INTERVAL}s, order={_SEND_ORDER})")
            if args.csv:
                _eprint(f"CSV output -> {args.csv}")
        except Exception:
            pass

    stream_gnb_log(args.input, follow=(not args.once))