import { describe, it, expect } from 'vitest';
import { RaceSimulator, UmaStatus, TrackDetail } from './RaceSimulator';

describe('RaceSimulator', () => {
  const defaultStatus: UmaStatus = {
    speed: 1200, stamina: 1000, power: 1000, guts: 1000, wisdom: 1000,
    condition: 2, // 普通 (1.0)
    style: 1, // 逃げ
    distanceFit: 'A', surfaceFit: 'A', styleFit: 'A'
  };
  const defaultTrack: TrackDetail = { distance: 2000, surface: 1, surfaceCondition: 0, courseSetStatus: [] };

  it('should calculate base speed correctly', () => {
    const sim = new RaceSimulator(defaultStatus, defaultTrack);
    expect(sim.baseSpeed).toBeCloseTo(20.0, 6);
  });

  it('should calculate modified statuses correctly', () => {
    const status = { ...defaultStatus, condition: 0 }; // 絶好調 (1.04)
    const sim = new RaceSimulator(status, defaultTrack);
    
    expect(sim.modifiedSpeed).toBeCloseTo(1200 * 1.04, 6); // 1248
    expect(sim.modifiedStamina).toBeCloseTo(1000 * 1.04, 6); // 1040
    expect(sim.modifiedPower).toBeCloseTo(1000 * 1.04, 6); // 1040
    expect(sim.modifiedGuts).toBeCloseTo(1000 * 1.04, 6); // 1040
    expect(sim.modifiedWisdom).toBeCloseTo(1000 * 1.04 * 1.0 /* styleFit A */, 6); // 1040
  });

  it('should calculate max SP correctly', () => {
    const sim = new RaceSimulator(defaultStatus, defaultTrack);
    expect(sim.spMax).toBeCloseTo(2760, 6);
  });

  it('should calculate phase target speeds (v0-v3)', () => {
    const sim = new RaceSimulator(defaultStatus, defaultTrack);
    expect(sim.v0).toBeCloseTo(20 * 0.85, 6); // 17
    expect(sim.v1).toBeCloseTo(20.0, 6);
    expect(sim.v2).toBeCloseTo(19.6, 6);
    expect(sim.v3).toBeCloseTo(19.24 + Math.sqrt(2.4), 6);
  });

  it('should calculate base accelerations (a0-a3)', () => {
    const sim = new RaceSimulator(defaultStatus, defaultTrack);
    const expectedBaseAccel = 0.0006 * Math.sqrt(500000);
    
    expect(sim.a0).toBeCloseTo(24 + expectedBaseAccel, 6);
    expect(sim.a1).toBeCloseTo(expectedBaseAccel, 6);
    expect(sim.a2).toBeCloseTo(-0.8, 6);
    expect(sim.a3).toBeCloseTo(expectedBaseAccel * 0.996, 6);
  });

  it('should calculate spurtSpCoef correctly', () => {
    const sim = new RaceSimulator(defaultStatus, defaultTrack);
    // modifiedGuts = 1000 (cond = 2, so 1.0)
    const expected = 1.0 + 200.0 / Math.sqrt(600 * 1000);
    expect(sim.spurtSpCoef).toBeCloseTo(expected, 6);
  });

  it('should calculate consumePerSecond correctly', () => {
    const sim = new RaceSimulator(defaultStatus, defaultTrack);
    // phase 1:
    // condKey = 1 (良)
    // spConsumptionCoef for 芝, 良 is 1
    expect(sim.consumePerSecond(20, 20, 1)).toBeCloseTo(20.0, 6);

    // phase 2 (spurt):
    const expectedSpurt = 20.0 * sim.spurtSpCoef;
    expect(sim.consumePerSecond(20, 20, 2)).toBeCloseTo(expectedSpurt, 6);
  });

  it('should run a full simulation without infinite loop', () => {
    const sim = new RaceSimulator(defaultStatus, defaultTrack);
    sim.simulateRace();

    expect(sim.position).toBeGreaterThanOrEqual(defaultTrack.distance);
    expect(sim.frames.length).toBeGreaterThan(0);
    expect(sim.frameElapsed).toBeGreaterThan(0);
    expect(sim.frameElapsed).toBeLessThan(5000); // 無限ループ対策の閾値未満であること
    
    // Check that we eventually consumed SP
    expect(sim.sp).toBeLessThan(sim.spMax);
    
    // Check finish time roughly
    // 2000m at ~20m/s is around 100 seconds, so ~1500 frames
    expect(sim.frames.length).toBeGreaterThan(1000);
    expect(sim.frames.length).toBeLessThan(2000);
  });
});

