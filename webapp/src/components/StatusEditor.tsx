import React, { useState, useEffect } from 'react';
import { UmaStatusData } from '../lib/types';
import './StatusEditor.css';

interface StatusEditorProps {
  initialData: UmaStatusData;
  onSave: (data: UmaStatusData) => void;
  onCancel: () => void;
}

export const StatusEditor: React.FC<StatusEditorProps> = ({ initialData, onSave, onCancel }) => {
  const [data, setData] = useState<UmaStatusData>(initialData);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const handleStatChange = (key: keyof UmaStatusData, value: string) => {
    const numValue = parseInt(value, 10);
    setData((prev) => ({
      ...prev,
      [key]: isNaN(numValue) ? 0 : numValue,
    }));
  };

  const handleAptitudeChange = (key: keyof UmaStatusData['aptitudes'], value: string) => {
    setData((prev) => ({
      ...prev,
      aptitudes: {
        ...prev.aptitudes,
        [key]: value,
      },
    }));
  };

  const handleSkillChange = (index: number, value: string) => {
    setData((prev) => {
      const newSkills = [...prev.skills];
      newSkills[index] = value;
      return { ...prev, skills: newSkills };
    });
  };

  const addSkill = () => {
    setData((prev) => ({ ...prev, skills: [...prev.skills, ""] }));
  };

  const removeSkill = (index: number) => {
    setData((prev) => {
      const newSkills = [...prev.skills];
      newSkills.splice(index, 1);
      return { ...prev, skills: newSkills };
    });
  };

  const renderStatInput = (label: string, key: keyof UmaStatusData) => (
    <div className="stat-input-group">
      <label>{label}</label>
      <input
        type="number"
        value={String(data[key])}
        onChange={(e) => handleStatChange(key, e.target.value)}
        className="form-input"
      />
    </div>
  );

  const renderAptitudeInput = (label: string, key: keyof UmaStatusData['aptitudes']) => (
    <div className="aptitude-input-group">
      <label>{label}</label>
      <select
        value={data.aptitudes[key]}
        onChange={(e) => handleAptitudeChange(key, e.target.value)}
        className="form-select"
      >
        {["S", "A", "B", "C", "D", "E", "F", "G"].map(rank => (
          <option key={rank} value={rank}>{rank}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="status-editor-container">
      <h2>ステータス・取得スキル 編集</h2>
      
      <div className="editor-section">
        <h3>基礎ステータス</h3>
        <div className="stats-grid">
          {renderStatInput('スピード', 'speed')}
          {renderStatInput('スタミナ', 'stamina')}
          {renderStatInput('パワー', 'power')}
          {renderStatInput('根性', 'guts')}
          {renderStatInput('賢さ', 'wisdom')}
        </div>
      </div>

      <div className="editor-section">
        <h3>バ場・距離・脚質適性</h3>
        <div className="aptitudes-grid">
          {renderAptitudeInput('芝', 'turf')}
          {renderAptitudeInput('ダート', 'dirt')}
          {renderAptitudeInput('短距離', 'short')}
          {renderAptitudeInput('マイル', 'mile')}
          {renderAptitudeInput('中距離', 'medium')}
          {renderAptitudeInput('長距離', 'long')}
          {renderAptitudeInput('逃げ', 'nige')}
          {renderAptitudeInput('先行', 'senkou')}
          {renderAptitudeInput('差し', 'sashi')}
          {renderAptitudeInput('追込', 'oikomi')}
        </div>
      </div>

      <div className="editor-section">
        <h3>取得スキル</h3>
        <div className="skills-list">
          {data.skills.map((skill, index) => (
            <div key={index} className="skill-item">
              <input
                type="text"
                value={skill}
                onChange={(e) => handleSkillChange(index, e.target.value)}
                className="form-input skill-input"
              />
              <button onClick={() => removeSkill(index)} className="btn-remove">削除</button>
            </div>
          ))}
          <button onClick={addSkill} className="btn-add">スキルを追加</button>
        </div>
      </div>

      <div className="editor-actions">
        <button onClick={onCancel} className="btn-cancel">キャンセル</button>
        <button onClick={() => onSave(data)} className="btn-save">決定してシミュレーターへ反映</button>
      </div>
    </div>
  );
};
