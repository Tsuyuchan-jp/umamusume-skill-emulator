const fs = require('fs');
const data = JSON.parse(fs.readFileSync('track_summary.json', 'utf8'));

const tsCode = `// Generated from umasim rawCourseData

export interface TrackCourse {
  id: string;
  name: string;
  dist: number;
  type: '芝' | 'ダート';
}

export interface TrackLocation {
  id: string;
  name: string;
  courses: TrackCourse[];
}

export const trackData: TrackLocation[] = ${JSON.stringify(data, null, 2)};
`;

fs.writeFileSync('desktop-app/app/lib/trackData.ts', tsCode);
console.log('Created app/lib/trackData.ts');
