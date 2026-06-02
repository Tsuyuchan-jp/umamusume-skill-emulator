import { describe, it, expect } from 'vitest';
import { RaceSimulator, UmaStatus, TrackDetail } from './RaceSimulator';

describe('RaceSimulator', () => {
  it('should calculate base speed correctly (2000m)', () => {
    const status: UmaStatus = {
      speed: 1200, stamina: 1000, power: 1000, guts: 1000, wisdom: 1000,
      condition: 2, style: 1, distanceFit: 'A', surfaceFit: 'A', styleFit: 'A'
    };
    const track: TrackDetail = { distance: 2000, surface: 1, courseSetStatus: [] };
    
    const sim = new RaceSimulator(status, track);
    expect(sim.baseSpeed).toBeCloseTo(20.0, 6);
  });

  it('should calculate base speed correctly (3200m)', () => {
    const status: UmaStatus = {
      speed: 1200, stamina: 1000, power: 1000, guts: 1000, wisdom: 1000,
      condition: 2, style: 1, distanceFit: 'A', surfaceFit: 'A', styleFit: 'A'
    };
    const track: TrackDetail = { distance: 3200, surface: 1, courseSetStatus: [] };
    
    const sim = new RaceSimulator(status, track);
    // 20 - (3200 - 2000) / 1000 = 20 - 1.2 = 18.8
    expect(sim.baseSpeed).toBeCloseTo(18.8, 6);
  });
  
  it('should handle exceed status correctly', () => {
    const status: UmaStatus = {
      speed: 1400, stamina: 1000, power: 1000, guts: 1000, wisdom: 1000,
      condition: 2, style: 1, distanceFit: 'A', surfaceFit: 'A', styleFit: 'A'
    };
    const track: TrackDetail = { distance: 2000, surface: 1, courseSetStatus: [] };
    
    const sim = new RaceSimulator(status, track);
    expect(sim.calcExceedStatus(1400)).toBe(1300); // 1200 + 200 / 2
    expect(sim.calcExceedStatus(1000)).toBe(1000);
  });
});
