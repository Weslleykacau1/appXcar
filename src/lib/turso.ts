import { createClient } from '@libsql/client';

const turso = createClient({
  url: 'libsql://database-teal-dog-vercel-icfg-bhg3klnbyhajtpccsrrjwoor.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NTMxMjUwOTgsImlkIjoiNGJjOWM3ZWItYmJkNC00NmJkLTgzYWUtNDVjYjA4MDhhMjdmIiwicmlkIjoiNjczNGI5NTgtNGJkOC00ZjNmLWJkMGUtYTAyOTk4YTFhYWU2In0.Y_j_Dv66el5CvWHOVrplklH9z4DDxT5x3EbfuylypagG7UVyOPn9l46HikZ3eQ40lt0LZq7-yueH4v4nlJ02Cw'
});

export interface UserShortcut {
  id: number;
  label: string;
  address: string;
  lat: number;
  lng: number;
}

export async function saveUserShortcut(userId: string, label: string, address: string, lat: number, lng: number) {
  await turso.execute(
    'INSERT INTO user_shortcuts (user_id, label, address, lat, lng) VALUES (?, ?, ?, ?, ?)',
    [userId, label, address, lat, lng]
  );
}

export async function getUserShortcuts(userId: string): Promise<UserShortcut[]> {
  const result = await turso.execute(
    'SELECT id, label, address, lat, lng FROM user_shortcuts WHERE user_id = ?',
    [userId]
  );
  return result.rows.map(row => ({
    id: Number(row.id),
    label: String(row.label),
    address: String(row.address),
    lat: Number(row.lat),
    lng: Number(row.lng)
  }));
}

export async function removeUserShortcut(shortcutId: number) {
  await turso.execute(
    'DELETE FROM user_shortcuts WHERE id = ?',
    [shortcutId]
  );
}

export async function updateUserShortcut(shortcutId: number, label: string, address: string, lat: number, lng: number) {
  await turso.execute(
    'UPDATE user_shortcuts SET label = ?, address = ?, lat = ?, lng = ? WHERE id = ?',
    [label, address, lat, lng, shortcutId]
  );
}

export default turso; 