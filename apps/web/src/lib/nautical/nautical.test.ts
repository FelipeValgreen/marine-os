import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateAnchorScope,
  evaluateAnchorWatch,
  calculateApparentWind,
  calculateTrueWind,
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
