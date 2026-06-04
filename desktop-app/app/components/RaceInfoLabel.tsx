import React from 'react';
import { SimTab } from '../lib/types';
import { trackData } from '../lib/trackData';

interface RaceInfoLabelProps {
  activeTab: SimTab | null;
  simulationCount: number;
}

export function RaceInfoLabel({ activeTab, simulationCount }: RaceInfoLabelProps) {
  if (!activeTab || !activeTab.raceCondition) return <span>東京 芝 2400m / 100走</span>;
  
  const cond = activeTab.raceCondition;
  const loc = trackData.find(l => l.id === cond.locationId);
  const course = loc?.courses.find(c => c.id === cond.courseId);
  const SURFACE_MAP: Record<number, string> = { 1: '良', 2: '稍重', 3: '重', 4: '不良' };
  
  const parts = [];
  if (loc && course) parts.push(`${loc.name} ${course.name}`);
  if (SURFACE_MAP[cond.surfaceCond]) parts.push(SURFACE_MAP[cond.surfaceCond]);
  if (cond.playerNum) parts.push(`${cond.playerNum}人`);
  
  const runCount = activeTab.simResultDump?.length || simulationCount;
  parts.push(`${runCount.toLocaleString()}走`);
  
  return <span>{parts.join(' / ')}</span>;
}
