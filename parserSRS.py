import re
import time
import json
import csv
import requests

input_file = "output.txt"
csv_file = "gnb.csv"
endpoint_url = "https://af-25.vercel.app/api/ingest"  # aggiorna con il tuo URL
send_every = 10  # invia ogni 10 righe

# regex for capturing pci, rnti, DL e UL
pattern = re.compile(
    r"\s*(\d+)\s+(\d+)\s+(\S+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\d+)\s*\|\s*(\S+)\s+(\d+)\s+(\S+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\d+)"
)

def convert_value(val):
    """Converti '1.4k' -> 1400, '50%' -> 50, 'n/a' -> None"""
    if val.lower().endswith("k"):
        return int(float(val[:-1]) * 1000)
    elif val.lower().endswith("M"):
        return int(float(val[:-1]) * 1000000)
    elif val.endswith("%"):
        return int(val[:-1])
    elif val.lower() == "n/a":
        return None
    else:
        try:
            return int(val)
        except:
            try:
                return float(val)
            except:
                return val

# csv header
with open(csv_file, "a", newline="") as f:
    writer = csv.writer(f)
    if f.tell() == 0:
        writer.writerow([
            "timestamp",
            "pci", "rnti",
            "cqi_dl", "ri_dl", "mcs_dl", "brate_dl", "ok_dl", "nok_dl", "perc_dl", "dl_bs",
            "pusch_ul", "mcs_ul", "brate_ul", "ok_ul", "nok_ul", "perc_ul", "bsr"
        ])

line_count = 0  # contatore delle righe per invio HTTP


with open(input_file, "r") as f:
    f.seek(0, 2)  # vai alla fine del file
    while True:
        line = f.readline()
        if not line:
            time.sleep(0.1)
            continue

        line = line.strip()
        if not line or line.startswith("pci") or line.startswith("-"):
            continue

        match = pattern.match(line)
        if match:
            groups = match.groups()
            values = [convert_value(v) for v in groups]

            pci = values[0]
            rnti = values[1]
            cqi_dl, ri_dl, mcs_dl, brate_dl, ok_dl, nok_dl, perc_dl, dl_bs = values[2:10]
            pusch_ul, mcs_ul, brate_ul, ok_ul, nok_ul, perc_ul, bsr = values[10:]

            timestamp = int(time.time() * 1000)  # millisecondi

            # save in CSV file
            with open(csv_file, "a", newline="") as out_f:
                writer = csv.writer(out_f)
                writer.writerow([timestamp, pci, rnti,
                                 cqi_dl, ri_dl, mcs_dl, brate_dl, ok_dl, nok_dl, perc_dl, dl_bs,
                                 pusch_ul, mcs_ul, brate_ul, ok_ul, nok_ul, perc_ul, bsr])

            line_count += 1

            # send every "send_every" measurements
            if line_count % send_every == 0:
                srsRANData = {
                    "timestamp": timestamp,
                    "source": "srsRAN",
                    "ues": [
                        {
                            "pci": pci,
                            "rnti": rnti,
                            "downlink": {
                                "cqi": cqi_dl,
                                "ri": ri_dl,
                                "mcs": mcs_dl,
                                "bitrate": brate_dl,
                                "packets_ok": ok_dl,
                                "packets_nok": nok_dl,
                                "drop_rate": perc_dl,
                                "buffer_status": dl_bs
                            },
                            "uplink": {
                                "pusch_sinr": pusch_ul,
                                "mcs": mcs_ul,
                                "bitrate": brate_ul,
                                "packets_ok": ok_ul,
                                "packets_nok": nok_ul,
                                "drop_rate": perc_ul,
                                "bsr": bsr
                            }
                        }
                    ]
                }

                try:
                    response = requests.post(endpoint_url, json=srsRANData)
                    print(f"Sending")
                    if response.status_code != 200:
                        print(f"Warning: HTTP {response.status_code}")
                except Exception as e:
                    print(f"Error sending data: {e}")