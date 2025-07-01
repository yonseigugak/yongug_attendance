// app/api/options/route.ts
import { google } from 'googleapis';
import type { NextRequest } from 'next/server';

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
    const configRange = 'CONFIG!A:B'; // 관리자 탭 이름이 CONFIG라고 가정

    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: configRange,
    });

    // ▸ 첫 행(헤더) 제외, 빈 셀 제거
    const rows = (data.values ?? []).slice(1);
    const songs = Array.from(new Set(rows.map(r => r[0]).filter(Boolean)));
    const timeSlots = Array.from(new Set(rows.map(r => r[1]).filter(Boolean)));

    return Response.json({ songs, timeSlots });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'CONFIG 탭 읽기 실패' }, { status: 500 });
  }
}
