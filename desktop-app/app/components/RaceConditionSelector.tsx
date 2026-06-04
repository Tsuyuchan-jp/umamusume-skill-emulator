import React, { useState, useEffect, useRef } from 'react';
import { trackData } from '../lib/trackData';
import { MapPin, Flag, CloudRain, Users, CalendarDays } from 'lucide-react';

export interface RaceCondition {
  locationId: string;
  courseId: string;
  surfaceCond: number;
  playerNum: number;
}

interface RacePreset extends RaceCondition {
  name: string;
}

interface RaceConditionSelectorProps {
  condition: RaceCondition;
  onChange: (condition: RaceCondition) => void;
}

const SURFACE_CONDITIONS = [
  { value: 1, label: '良' },
  { value: 2, label: '稍重' },
  { value: 3, label: '重' },
  { value: 4, label: '不良' },
];

const PLAYER_NUMS = [9, 12, 18];

export function RaceConditionSelector({ condition, onChange }: RaceConditionSelectorProps) {
  const [presets, setPresets] = useState<RacePreset[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPresetActive = (preset: RacePreset) => {
    return condition.locationId === preset.locationId &&
           condition.courseId === preset.courseId &&
           condition.surfaceCond === preset.surfaceCond &&
           condition.playerNum === preset.playerNum;
  };

  useEffect(() => {
    // 外部ファイルからプリセットを取得
    fetch('/race_presets.json')
      .then(res => res.json())
      .then(data => setPresets(data))
      .catch(err => console.error('Failed to load race presets:', err));
  }, []);

  const selectedLocation = trackData.find(loc => loc.id === condition.locationId);

  const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const locId = e.target.value;
    const loc = trackData.find(l => l.id === locId);
    if (loc && loc.courses.length > 0) {
      onChange({
        ...condition,
        locationId: locId,
        courseId: loc.courses[0].id // コースを自動的に最初のものに切り替える
      });
    }
  };

  const handleCourseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...condition, courseId: e.target.value });
  };

  const handleSurfaceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...condition, surfaceCond: Number(e.target.value) });
  };

  const handlePlayerNumChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...condition, playerNum: Number(e.target.value) });
  };

  return (
    <div className="bg-[#18181b] rounded-lg p-5 border border-[#27272a]">
      <div className="flex items-center gap-2 mb-4">
        <Flag className="w-5 h-5 text-[#f4f4f5]" />
        <h2 className="text-lg font-bold text-[#f4f4f5]">レース環境設定</h2>
      </div>

      {presets.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-1 mb-2 text-sm text-[#a1a1aa]">
            <CalendarDays className="w-4 h-4" />
            <span>イベントプリセット</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  onChange({
                    locationId: preset.locationId,
                    courseId: preset.courseId,
                    surfaceCond: preset.surfaceCond,
                    playerNum: preset.playerNum
                  });
                  setIsAnimating(true);
                  if (animTimerRef.current) clearTimeout(animTimerRef.current);
                  animTimerRef.current = setTimeout(() => setIsAnimating(false), 500);
                }}
                className={`px-3 py-1.5 text-sm rounded transition-all duration-300 border ${
                  isPresetActive(preset)
                    ? 'bg-blue-600 text-white border-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.3)]'
                    : 'bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] border-[#3f3f46] hover:border-[#52525b]'
                }`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`grid grid-cols-2 gap-4 p-4 -mx-4 rounded-xl transition-all duration-500 ${
        isAnimating ? 'bg-blue-500/10 ring-1 ring-blue-500/50 shadow-[0_0_15px_rgba(37,99,235,0.2)]' : 'bg-transparent ring-0 ring-transparent shadow-none'
      }`}>
        <div>
          <label className="block text-sm font-medium text-[#a1a1aa] mb-1 flex items-center gap-1">
            <MapPin className={`w-4 h-4 transition-transform duration-300 ${isAnimating ? 'scale-125 text-blue-400' : ''}`} /> レース場
          </label>
          <select
            value={condition.locationId}
            onChange={handleLocationChange}
            className="w-full bg-[#09090b] border border-[#27272a] rounded px-3 py-2 text-[#e4e4e7] focus:outline-none focus:border-[#3f3f46]"
          >
            {trackData.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#a1a1aa] mb-1 flex items-center gap-1">
            <Flag className={`w-4 h-4 transition-transform duration-300 ${isAnimating ? 'scale-125 text-blue-400' : ''}`} /> コース
          </label>
          <select
            value={condition.courseId}
            onChange={handleCourseChange}
            className="w-full bg-[#09090b] border border-[#27272a] rounded px-3 py-2 text-[#e4e4e7] focus:outline-none focus:border-[#3f3f46]"
            disabled={!selectedLocation}
          >
            {selectedLocation?.courses.map(course => (
              <option key={course.id} value={course.id}>{course.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#a1a1aa] mb-1 flex items-center gap-1">
            <CloudRain className={`w-4 h-4 transition-transform duration-300 ${isAnimating ? 'scale-125 text-blue-400' : ''}`} /> バ場状態
          </label>
          <select
            value={condition.surfaceCond}
            onChange={handleSurfaceChange}
            className="w-full bg-[#09090b] border border-[#27272a] rounded px-3 py-2 text-[#e4e4e7] focus:outline-none focus:border-[#3f3f46]"
          >
            {SURFACE_CONDITIONS.map(cond => (
              <option key={cond.value} value={cond.value}>{cond.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#a1a1aa] mb-1 flex items-center gap-1">
            <Users className={`w-4 h-4 transition-transform duration-300 ${isAnimating ? 'scale-125 text-blue-400' : ''}`} /> 出走人数
          </label>
          <select
            value={condition.playerNum}
            onChange={handlePlayerNumChange}
            className="w-full bg-[#09090b] border border-[#27272a] rounded px-3 py-2 text-[#e4e4e7] focus:outline-none focus:border-[#3f3f46]"
          >
            {PLAYER_NUMS.map(num => (
              <option key={num} value={num}>{num}人</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
