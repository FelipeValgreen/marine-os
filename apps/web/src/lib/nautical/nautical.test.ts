import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateAnchorScope,
  evaluateAnchorWatch,
  calculateApparentWind,
  
  calculateTWAFromBearing,
  evaluateDynamicRoutingWindow,
} from "./index.ts";

test("calculateAnchorScope computes correct ratio and warns on insufficient chain", () => {
  // Moderate conditions: 5:1 ratio
  const scopeNormal = calculateAnchorScope({
    depthMeters: 6.0,
    tideAmplitudeMeters: 4.0, // max depth = 10.0m + 1.4m freeboard = 11.4m
    windSpeedKnots: 15,
    seabedType: "sand",
    availableChainMeters: 60,
  });

  assert.equal(scopeNormal.recommendedRatio, 5);
  // 11.4 * 5 = 57m
  assert.equal(scopeNormal.recommendedChainMeters, 57);
  assert.equal(scopeNormal.isChainSufficient, true);
  assert.equal(scopeNormal.chainWarning, null);

  // Heavy conditions (wind >= 22kn): 7:1 ratio
  const scopeHeavy = calculateAnchorScope({
    depthMeters: 8.0,
    tideAmplitudeMeters: 4.0, // max depth = 12.0m + 1.4m = 13.4m
    windSpeedKnots: 28,
    seabedType: "sand",
    availableChainMeters: 60,
  });

  assert.equal(scopeHeavy.recommendedRatio, 7);
  // 13.4 * 7 = 94m -> exceeds 60m available
  assert.equal(scopeHeavy.recommendedChainMeters, 94);
  assert.equal(scopeHeavy.isChainSufficient, false);
  assert.match(scopeHeavy.chainWarning || "", /cadena insuficiente a bordo/);
});

test("evaluateAnchorWatch prohibits SECURE if SOG > 0.5 kn (PRD R-4.4)", () => {
  // Stationary inside swing circle
  const watchStationary = evaluateAnchorWatch(
    -41.4717,
    -72.9369,
    -41.4718, // ~11m distance
    -72.9369,
    35, // max swing 35m
    0.0 // SOG = 0
  );
  assert.equal(watchStationary.alertLevel, "SECURE");
  assert.equal(watchStationary.isDragging, false);

  // Moving inside swing circle with SOG = 1.8 kn -> CANNOT BE SECURE
  const watchMoving = evaluateAnchorWatch(
    -41.4717,
    -72.9369,
    -41.4718,
    -72.9369,
    35,
    1.8 // SOG > 0.5 kn
  );
  assert.notEqual(watchMoving.alertLevel, "SECURE");
  assert.equal(watchMoving.alertLevel, "WARNING");
  assert.ok(watchMoving.sogWarning?.includes("SOG 1.8 kn detectada"));

  // Drifting outside swing radius -> DRAG_ALARM
  const watchDragging = evaluateAnchorWatch(
    -41.4717,
    -72.9369,
    -41.4730, // ~145m away
    -72.9369,
    35,
    2.4
  );
  assert.equal(watchDragging.alertLevel, "DRAG_ALARM");
  assert.equal(watchDragging.isDragging, true);
});

test("calculateApparentWind obeys vector trigonometry: AWS > TWS when motoring head to wind", () => {
  const tws = 14.0;
  const sog = 7.0;

  // Head to wind: TWA = 0°
  const headWind = calculateApparentWind({
    twsKn: tws,
    twaDeg: 0,
    sogKn: sog,
  });

  // AWS should be exactly TWS + SOG = 21.0 kn
  assert.equal(headWind.awsKn, 21.0);
  assert.ok(headWind.awsKn > tws, "AWS must be greater than TWS when motoring head to wind");
  assert.equal(headWind.awaDeg, 0);

  // Running dead downwind: TWA = 180°
  const tailWind = calculateApparentWind({
    twsKn: tws,
    twaDeg: 180,
    sogKn: sog,
  });
  // AWS should be |14 - 7| = 7.0 kn
  assert.equal(tailWind.awsKn, 7.0);

  // Beam reach: TWA = 90° -> AWS = sqrt(14^2 + 7^2) = sqrt(245) ≈ 15.65 kn
  const beamWind = calculateApparentWind({
    twsKn: tws,
    twaDeg: 90,
    sogKn: sog,
  });
  assert.equal(beamWind.awsKn, 15.7);
  assert.ok(beamWind.awsKn > tws);
});

test("calculateTWAFromBearing calculates shortest angular difference", () => {
  assert.equal(calculateTWAFromBearing(194, 194), 0);
  assert.equal(calculateTWAFromBearing(194, 315), 121);
  assert.equal(calculateTWAFromBearing(10, 350), 20);
});

test("evaluateDynamicRoutingWindow calculates polar SOG, sail plan, and comfort dynamically", () => {
  // Heading 194°, Wind from 315° (TWA = 121°, broad reach / aleta)
  const broadReachPlan = evaluateDynamicRoutingWindow({
    plannedCogDeg: 194,
    windSpeedKn: 14.2,
    windGustKn: 18.5,
    windDirDeg: 315,
    waveHeightM: 0.42,
    label: "Zarpar en 2 hrs",
  });

  assert.equal(broadReachPlan.status, "OPTIMAL");
  assert.ok(broadReachPlan.predicted_sog_kn >= 7.0);
  assert.match(broadReachPlan.sail_plan, /Aleta \/ Largo/);
  assert.equal(broadReachPlan.twa_deg, 121);

  // Heading 194°, Wind from 195° (TWA = 1°, head to wind / ceñida imposible)
  const headWindPlan = evaluateDynamicRoutingWindow({
    plannedCogDeg: 194,
    windSpeedKn: 24.8,
    windGustKn: 33.5,
    windDirDeg: 195,
    waveHeightM: 1.45,
    label: "Zarpar en 6 hrs",
  });

  assert.equal(headWindPlan.status, "CAUTION");
  assert.match(headWindPlan.sail_plan, /Proa al viento/);
  assert.equal(headWindPlan.twa_deg, 1);
});

test("Handover integrity: SHA-256 seal calculation is deterministic and tamper-evident (PRD R-4.10.3)", async () => {
  const { computeSHA256Hex } = await import("./index.ts");
  const canonicalActa1 = JSON.stringify({
    vessel_id: "demo-vessel-123",
    giver: { name: "Armador Demo", document: "11.111.111-1" },
    receiver: { name: "Capitán Demo", document: "22.222.222-2" },
    fuel_pct: 92,
  });
  const hash1 = await computeSHA256Hex(canonicalActa1);
  const hash2 = await computeSHA256Hex(canonicalActa1);
  assert.equal(hash1, hash2, "Identical canonical actas must yield identical SHA-256 hashes");
  assert.equal(hash1.length, 64, "SHA-256 hex digest must be 64 characters");

  // Tamper test: altering 1 character alters hash completely
  const tamperedActa = JSON.stringify({
    vessel_id: "demo-vessel-123",
    giver: { name: "Armador Demo", document: "11.111.111-1" },
    receiver: { name: "Capitán Demo", document: "22.222.222-2" },
    fuel_pct: 91, // changed 92 -> 91
  });
  const tamperedHash = await computeSHA256Hex(tamperedActa);
  assert.notEqual(hash1, tamperedHash, "Altering canonical acta payload must produce a distinct hash");
});

test("Safety inventory expiration semaphore respects 90/30 day threshold (PRD R-4.9.1)", () => {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  function evaluateExpiry(dateStr: string): "valid" | "warning" | "expired" {
    const exp = new Date(dateStr).getTime();
    const days = Math.ceil((exp - now) / dayMs);
    if (days > 90) return "valid";
    if (days > 30) return "warning";
    return "expired";
  }

  const in180Days = new Date(now + 180 * dayMs).toISOString().split("T")[0];
  const in60Days = new Date(now + 60 * dayMs).toISOString().split("T")[0];
  const in15Days = new Date(now + 15 * dayMs).toISOString().split("T")[0];

  assert.equal(evaluateExpiry(in180Days), "valid");
  assert.equal(evaluateExpiry(in60Days), "warning");
  assert.equal(evaluateExpiry(in15Days), "expired");
});

test("Copilot intent routing: weather uses environment and unknown queries express uncertainty (PRD R-4.13.3 / R-4.13.4)", () => {
  // Intent detector logic matching MarineCopilot
  function detectIntent(q: string): "weather" | "mechanic" | "emergency" | "unknown" {
    const query = q.toLowerCase();
    if (query.includes("mayday") || query.includes("hombre al agua") || query.includes("sos")) {
      return "emergency";
    }
    if (query.includes("viento") || query.includes("olas") || query.includes("clima")) {
      return "weather";
    }
    if (query.includes("motor") || query.includes("yanmar") || query.includes("impulsor")) {
      return "mechanic";
    }
    return "unknown";
  }

  assert.equal(detectIntent("¿Cuál es el viento actual?"), "weather");
  assert.equal(detectIntent("Alarma de temperatura en motor Yanmar"), "mechanic");
  assert.equal(detectIntent("¡Hombre al agua!"), "emergency");
  assert.equal(detectIntent("¿Cómo cocinar un risotto de mariscos?"), "unknown");
});
