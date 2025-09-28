// lib/mockData.ts
// Generates fake srsRAN / OAI data for testing dashboard views

export function generateMockData() {
  const timestamp = Date.now();

  // Random helper
  const rand = (min: number, max: number) =>
    Math.round(min + Math.random() * (max - min));

  const ue = {
    pci: rand(1, 100),
    rnti: rand(1000, 5000),
    downlink: {
      cqi: rand(1, 15),
      ri: rand(1, 2),
      mcs: rand(0, 28),
      bitrate: rand(5e6, 30e6),
      packets_ok: rand(500, 1000),
      packets_nok: rand(0, 20),
      drop_rate: Math.random() < 0.1 ? rand(1, 10) : 0,
      buffer_status: rand(1000, 50000)
    },
    uplink: {
      pusch_sinr: +(20 + Math.random() * 10).toFixed(1),
      rsrp: +(-30 + Math.random() * 10).toFixed(1),
      ri: rand(1, 2),
      mcs: rand(0, 28),
      bitrate: rand(5e6, 20e6),
      packets_ok: rand(300, 700),
      packets_nok: rand(0, 20),
      drop_rate: Math.random() < 0.1 ? rand(1, 8) : 0,
      bsr: rand(1000, 40000),
      timing_advance: rand(0, 5),
      phr: rand(0, 20)
    }
  };

  return {
    timestamp,
    source: "srsRAN",
    ues: [ue]
  };
}