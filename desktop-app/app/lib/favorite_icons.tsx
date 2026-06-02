import React from 'react';
import { Ban, Club, Spade, Heart, Diamond } from 'lucide-react';

// カスタムスニーカーSVG（ゲーム内の靴アイコンにより近い形状）
const SneakerIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 256 256" fill="currentColor" className={className}>
    <path d="M240,160h-8.2l-14.8-44.4a24,24,0,0,0-22.8-15.6H176V88a8,8,0,0,0-8-8H120a8,8,0,0,0-8,8v12H90.8L59.1,52.5A8,8,0,0,0,52,48H24a8,8,0,0,0,0,16H47.1l29.4,44.1A8,8,0,0,0,83.2,112H112v16H88a8,8,0,0,0,0,16h24v16H40a16,16,0,0,0-16,16v16a16,16,0,0,0,16,16H232a16,16,0,0,0,16-16V176A16,16,0,0,0,240,160Zm-8,32H40V176h80a8,8,0,0,0,0-16h40a8,8,0,0,0,0-16h16a8,8,0,0,1,7.6,5.5L194.2,160H216a8,8,0,0,1,8,8v8a8,8,0,0,0,8,8Z"/>
  </svg>
);

export interface FavoriteIconDef {
  id: number;
  label: string;
  render: (props: { className?: string }) => React.ReactNode;
}

// 絵文字の中央揃えの微調整用クラス（WindowsのSegoe UI Emoji等で右に寄る現象を補正）
const emojiClass = "text-[20px] leading-none block -translate-x-[1px] translate-y-[1px]";

export const FAVORITE_ICONS: FavoriteIconDef[] = [
  // 0: 設定なし
  { id: 0, label: '設定なし', render: ({ className }) => <Ban className={`text-zinc-600 ${className || ''}`} /> },
  
  // 1~5: 食べ物 (絵文字)
  { id: 1, label: 'にんじん', render: () => <span className={emojiClass}>🥕</span> },
  { id: 2, label: 'ごはん', render: () => <span className={emojiClass}>🍚</span> },
  { id: 3, label: 'はちみつドリンク', render: () => <span className={emojiClass}>🍯</span> },
  { id: 4, label: 'チョコケーキ', render: () => <span className={emojiClass}>🧁</span> },
  { id: 5, label: 'ショートケーキ', render: () => <span className={emojiClass}>🍰</span> },
  
  // 6~9: トランプ (色付きSVG)
  { id: 6, label: 'ダイヤ', render: ({ className }) => <Diamond className={`text-red-500 fill-red-500 ${className || ''}`} /> },
  { id: 7, label: 'スペード', render: ({ className }) => <Spade className={`text-blue-500 fill-blue-500 ${className || ''}`} /> },
  { id: 8, label: 'ハート', render: ({ className }) => <Heart className={`text-red-500 fill-red-500 ${className || ''}`} /> },
  { id: 9, label: 'クラブ', render: ({ className }) => <Club className={`text-emerald-500 fill-emerald-500 ${className || ''}`} /> },

  // 10~14: 靴 (色違いSVG)
  { id: 10, label: '短距離', render: ({ className }) => <SneakerIcon className={`text-pink-400 ${className || ''}`} /> },
  { id: 11, label: 'マイル', render: ({ className }) => <SneakerIcon className={`text-emerald-400 ${className || ''}`} /> },
  { id: 12, label: '中距離', render: ({ className }) => <SneakerIcon className={`text-yellow-400 ${className || ''}`} /> },
  { id: 13, label: '長距離', render: ({ className }) => <SneakerIcon className={`text-blue-400 ${className || ''}`} /> },
  { id: 14, label: 'ダート', render: ({ className }) => <SneakerIcon className={`text-red-500 ${className || ''}`} /> },

  // 15~16: その他 (絵文字)
  { id: 15, label: '握手', render: () => <span className={emojiClass}>🤝</span> },
  { id: 16, label: 'レポート', render: () => <span className={emojiClass}>📋</span> },

  // 17~20: 脚質 (CSS円形+文字)
  { id: 17, label: '逃げ', render: ({ className }) => <div className={`flex items-center justify-center rounded-full bg-zinc-200 text-blue-600 font-bold text-xs border-2 border-blue-600 ${className || 'w-5 h-5'}`}>逃</div> },
  { id: 18, label: '先行', render: ({ className }) => <div className={`flex items-center justify-center rounded-full bg-zinc-200 text-green-600 font-bold text-xs border-2 border-green-600 ${className || 'w-5 h-5'}`}>先</div> },
  { id: 19, label: '差し', render: ({ className }) => <div className={`flex items-center justify-center rounded-full bg-zinc-200 text-orange-500 font-bold text-xs border-2 border-orange-500 ${className || 'w-5 h-5'}`}>差</div> },
  { id: 20, label: '追込', render: ({ className }) => <div className={`flex items-center justify-center rounded-full bg-zinc-200 text-red-500 font-bold text-xs border-2 border-red-500 ${className || 'w-5 h-5'}`}>追</div> },
];

// 21~32: 番号 (1~12, CSS円形+文字)
for (let i = 1; i <= 12; i++) {
  FAVORITE_ICONS.push({
    id: 20 + i,
    label: `番号${i}`,
    render: ({ className }) => (
      <div className={`flex items-center justify-center rounded-full bg-zinc-200 text-blue-600 font-bold text-[10px] border-[1.5px] border-blue-600 ${className || 'w-5 h-5'}`}>
        {i}
      </div>
    )
  });
}
