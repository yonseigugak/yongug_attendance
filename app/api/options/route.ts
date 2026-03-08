// app/api/options/route.ts
import { google } from 'googleapis';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  try {
    /* 인증 */
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_SHEET_ID!;
    const configRange = 'CONFIG!A:C';

    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: configRange,
    });

    // 첫 행(헤더) 제외
    const rows = (data.values ?? []).slice(1);

    const songsSet = new Set<string>();
    const timeSlotsSet = new Set<string>();
    const statusesSet = new Set<string>();

    for (const row of rows) {
      const song = row?.[0]?.toString().trim();
      const time = row?.[1]?.toString().trim();
      const status = row?.[2]?.toString().trim();

      if (song) songsSet.add(song);
      if (time) timeSlotsSet.add(time);
      if (status) statusesSet.add(status);
    }

    const songs = Array.from(songsSet);
    const timeSlots = Array.from(timeSlotsSet);
    const statuses = Array.from(statusesSet);

    return Response.json({ songs, timeSlots, statuses });

  } catch (e) {
    console.error(e);
    return Response.json({ error: 'CONFIG 탭 읽기 실패' }, { status: 500 });
  }
}