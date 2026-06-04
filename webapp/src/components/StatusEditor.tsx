/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { FactorData, CharacterFactors, WhiteFactor } from '../lib/types';
import masterData from '../lib/master_data.json';

const charOptions = masterData.characters.map(c => ({ value: c.name, label: c.name }));
const blueOptions = masterData.factors.blue.map((f: any) => ({ value: f.name, label: f.name }));
const redOptions = masterData.factors.red.map((f: any) => ({ value: f.name, label: f.name }));
const greenOptions = masterData.factors.green.map((f: any) => ({ value: f.name, label: f.name }));
const whiteOptions = masterData.factors.white.map((f: any) => ({ value: f.name, label: f.name }));

const customStyles = {
  control: (base: any) => ({
    ...base,
    backgroundColor: '#09090b',
    borderColor: '#27272a',
    minHeight: '34px',
    boxShadow: 'none',
    '&:hover': { borderColor: '#3f3f46' }
  }),
  menu: (base: any) => ({
    ...base,
    backgroundColor: '#18181b',
    zIndex: 50
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isFocused ? '#27272a' : '#18181b',
    color: '#e4e4e7',
    cursor: 'pointer'
  }),
  singleValue: (base: any) => ({
    ...base,
    color: '#e4e4e7',
  }),
  input: (base: any) => ({
    ...base,
    color: '#e4e4e7',
  })
};

interface FactorEditorProps {
  initialData: FactorData | null;
  onSave: (data: FactorData) => void;
}

import { FAVORITE_ICONS } from '../lib/favorite_icons';

const emptyCharacterFactors = (name: string = ""): CharacterFactors => ({
  name,
  blue_factor: null,
  red_factor: null,
  green_factor: null,
  white_factors: []
});

const emptyFactorData: FactorData = {
  favorite_icon_id: 0,
  representative: emptyCharacterFactors(),
  parent1: emptyCharacterFactors(),
  parent2: emptyCharacterFactors(),
};

export function FactorEditor({ initialData, onSave }: FactorEditorProps) {
  const [data, setData] = useState<FactorData>(initialData || emptyFactorData);

  // Sync state if initialData changes (e.g. OCR completes)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(initialData || emptyFactorData);
  }, [initialData]);

  const updateCharacter = (
    key: keyof FactorData,
    field: keyof CharacterFactors,
    value: any | ((prev: any) => any)
  ) => {
    if (key === 'favorite_icon_id') return; // Should not happen here
    setData((prev) => {
      const target = prev[key] as CharacterFactors || emptyCharacterFactors();
      const nextValue = typeof value === 'function' ? value(target[field]) : value;
      return {
        ...prev,
        [key]: { ...target, [field]: nextValue }
      };
    });
  };

  const renderFavoriteIconPicker = () => {
    const currentId = data.favorite_icon_id || 0;
    
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-4">
        <h3 className="text-zinc-200 font-bold mb-3 text-sm">🔖 お気に入りアイコン</h3>
        <div className="flex flex-wrap gap-2">
          {FAVORITE_ICONS.map((icon) => (
            <button
              key={icon.id}
              onClick={() => setData({ ...data, favorite_icon_id: icon.id })}
              title={icon.label}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
                currentId === icon.id
                  ? 'bg-zinc-700 ring-2 ring-emerald-500'
                  : 'bg-zinc-800 hover:bg-zinc-700'
              }`}
            >
              {icon.render({ className: 'w-5 h-5' })}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderBasicFactor = (
    label: string,
    charKey: keyof FactorData,
    factorKey: 'blue_factor' | 'red_factor' | 'green_factor',
    colorClass: string,
    options: any[]
  ) => {
    if (charKey === 'favorite_icon_id') return null;
    const targetChar = data[charKey] as CharacterFactors;
    const factor = targetChar ? targetChar[factorKey] : null;

    return (
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-16 text-sm font-semibold ${colorClass}`}>{label}</span>
        <div className="flex-1">
          <Select
            options={options}
            value={factor?.name ? { value: factor.name, label: factor.name } : null}
            onChange={(selected: any) => {
              const newName = selected ? selected.value : '';
              if (!newName && !factor?.stars) {
                updateCharacter(charKey, factorKey, null);
              } else {
                updateCharacter(charKey, factorKey, { name: newName, stars: factor?.stars || 1 });
              }
            }}
            styles={customStyles}
            placeholder="因子名を選択..."
            isClearable
            className="text-sm"
          />
        </div>
        <select
          value={factor?.stars || 0}
          onChange={(e) => {
            const stars = parseInt(e.target.value, 10);
            updateCharacter(charKey, factorKey, { name: factor?.name || '', stars });
          }}
          className="bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1 text-sm text-zinc-200 outline-none focus:border-zinc-500"
        >
          <option value={0}>-</option>
          <option value={1}>★1</option>
          <option value={2}>★2</option>
          <option value={3}>★3</option>
        </select>
      </div>
    );
  };

  const renderCharacterSection = (title: string, charKey: keyof FactorData) => {
    if (charKey === 'favorite_icon_id') return null;
    const targetChar = data[charKey] as CharacterFactors || emptyCharacterFactors();

    const addWhiteFactor = () => {
      updateCharacter(charKey, 'white_factors', (prevWhites: WhiteFactor[] = []) => [
        ...prevWhites,
        { name: '', stars: 1 }
      ]);
    };

    const updateWhiteFactor = (index: number, field: keyof WhiteFactor, value: any) => {
      updateCharacter(charKey, 'white_factors', (prevWhites: WhiteFactor[] = []) => {
        const newWhites = [...prevWhites];
        if (newWhites[index]) {
          newWhites[index] = { ...newWhites[index], [field]: value };
        }
        return newWhites;
      });
    };

    const removeWhiteFactor = (index: number) => {
      updateCharacter(charKey, 'white_factors', (prevWhites: WhiteFactor[] = []) => {
        const newWhites = [...prevWhites];
        newWhites.splice(index, 1);
        return newWhites;
      });
    };

    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-4">
        <h3 className="text-zinc-200 font-bold mb-3">{title}</h3>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-16 text-sm text-zinc-400">ウマ娘名</span>
          <div className="flex-1">
            <Select
              options={charOptions}
              value={targetChar.name ? { value: targetChar.name, label: targetChar.name } : null}
              onChange={(selected: any) => updateCharacter(charKey, 'name', selected ? selected.value : '')}
              styles={customStyles}
              placeholder="ウマ娘名を選択..."
              isClearable
              className="text-sm"
            />
          </div>
        </div>

        {renderBasicFactor('青因子', charKey, 'blue_factor', 'text-blue-400', blueOptions)}
        {renderBasicFactor('赤因子', charKey, 'red_factor', 'text-red-400', redOptions)}
        {renderBasicFactor('緑因子', charKey, 'green_factor', 'text-green-400', greenOptions)}

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-zinc-100">白因子</span>
            <button
              onClick={addWhiteFactor}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded"
            >
              + 追加
            </button>
          </div>
          {targetChar.white_factors.map((wf, idx) => (
            <div key={idx} className="flex items-center gap-2 mb-2">
              <div className="flex-1">
                <Select
                  options={whiteOptions}
                  value={wf.name ? { value: wf.name, label: wf.name } : null}
                  onChange={(selected: any) => updateWhiteFactor(idx, 'name', selected ? selected.value : '')}
                  styles={customStyles}
                  placeholder="白因子名を選択..."
                  isClearable
                  className="text-sm"
                />
              </div>
              <select
                value={wf.stars}
                onChange={(e) => updateWhiteFactor(idx, 'stars', parseInt(e.target.value, 10))}
                className="bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1 text-sm text-zinc-200 outline-none focus:border-zinc-500"
              >
                <option value={1}>★1</option>
                <option value={2}>★2</option>
                <option value={3}>★3</option>
              </select>
              <button
                onClick={() => removeWhiteFactor(idx)}
                className="text-rose-400 hover:text-rose-300 px-2"
                title="削除"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const exportToJson = () => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `factor_data_verification_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full">
      <h2 className="text-lg font-semibold text-zinc-200 mb-4 flex items-center gap-2">
        <span className="text-indigo-400">🔍</span> 因子データ
      </h2>
      
      {renderFavoriteIconPicker()}
      
      {renderCharacterSection('【代表ウマ娘】', 'representative')}
      {renderCharacterSection('【親1】', 'parent1')}
      {renderCharacterSection('【親2】', 'parent2')}

      <div className="flex flex-col gap-3">
        <button
          onClick={exportToJson}
          className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-3 rounded-xl transition-colors border border-zinc-700 shadow-sm"
        >
          📥 データをJSONでエクスポート (検証用)
        </button>
        <button
          onClick={() => onSave(data)}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-colors shadow-lg"
        >
          ✅ 確定して保存
        </button>
      </div>
    </div>
  );
}
