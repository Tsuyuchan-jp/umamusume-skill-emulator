import { trackData, TrackCourse } from './trackData';
import { UmaStatusData } from './types';

export function getCourseById(locationId: string, courseId: string): TrackCourse | undefined {
  const loc = trackData.find(l => l.id === locationId);
  return loc?.courses.find(c => c.id === courseId);
}

export function getSurfaceKey(course?: TrackCourse): keyof UmaStatusData['aptitudes'] {
  if (!course) return 'turf';
  return course.type === 'ダート' ? 'dirt' : 'turf';
}

export function getDistanceKey(course?: TrackCourse): keyof UmaStatusData['aptitudes'] {
  if (!course) return 'medium';
  if (course.dist <= 1400) return 'short';
  if (course.dist <= 1800) return 'mile';
  if (course.dist <= 2400) return 'medium';
  return 'long';
}

export function getStyleKey(strategy?: string): keyof UmaStatusData['aptitudes'] {
  switch (strategy) {
    case 'NIGE':
      return 'nige';
    case 'SEN':
      return 'senkou';
    case 'SASI':
      return 'sashi';
    case 'OI':
      return 'oikomi';
    default:
      return 'nige';
  }
}
