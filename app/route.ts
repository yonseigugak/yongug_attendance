아래 코드 전체 복붙하세요!

```typescript
import { google } from 'googleapis';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  // Vercel Cron 인증 확인
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEETS_SHEET_ID;

  // 오늘 날짜 (KST)
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const today = `${kst.getFullYear()}-${(kst.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${kst.getDate().toString().padStart(2, '0')}`;

  const submitDate = today;
  const submitClock = `${kst.getHours().toString().padStart(2, '0')}:${kst
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;

  try {
    // 1. 시트 목록 + sheetId 맵 가져오기
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      includeGridData: false,
      fields: 'sheets.properties',
    });

    const sheetMap = new Map<string, number>();
    for (const s of meta.data.sheets ?? []) {
      const title = s.properties?.title;
      const id = s.properties?.sheetId;
      if (title !== undefined && id !== undefined) {
        sheetMap.set(title, id);
      }
    }

    // 2. CONFIG 시트에서 곡명 + 시간대 읽기
    const configRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'CONFIG!A2:B',
    });
    const configRows = configRes.data.values ?? [];

    // { 곡명: '19:00' } 형태로 변환 (시작 시간만 추출)
    const songTimeMap = new Map<string, string>();
    for (const row of configRows) {
      const songName = row[0]?.toString().trim();
      const timeRange = row[1]?.toString().trim(); // '19:00-20:30'
      if (songName && timeRange) {
        const startTime = timeRange.split('-')[0].trim(); // '19:00'
        songTimeMap.set(songName, startTime);
      }
    }

    // 3. 곡별명단 시트에서 곡별 멤버 읽기
    const rosterRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: '곡별명단!A1:Z',
    });
    const rosterRows = rosterRes.data.values ?? [];

    if (rosterRows.length === 0) {
      return new Response(JSON.stringify({ message: '명단 없음' }), { status: 200 });
    }

    // 1행: 곡명, 2행~: 멤버
    const songNames = rosterRows[0].map((v: string) => v?.toString().trim()).filter(Boolean);
    const membersBySong = new Map<string, string[]>();

    for (let col = 0; col < songNames.length; col++) {
      const song = songNames[col];
      const members: string[] = [];
      for (let row = 1; row < rosterRows.length; row++) {
        const name = rosterRows[row]?.[col]?.toString().trim();
        if (name) members.push(name);
      }
      membersBySong.set(song, members);
    }

    // 4. 각 곡별로 오늘 출석체크 안 한 사람 자동 결석 처리
    const results: string[] = [];

    for (const [song, members] of membersBySong.entries()) {
      const sheetId = sheetMap.get(song);
      if (sheetId === undefined) continue;

      const timeSlot = songTimeMap.get(song);
      if (!timeSlot) continue;

      // 해당 곡 시트에서 오늘 날짜 기록 읽기
      const range = `${song}!A:H`;
      const { data } = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });
      const rows = data.values ?? [];

      // 오늘 출석체크한 사람 목록
      const checkedToday = new Set<string>();
      for (const row of rows) {
        const rowDate = row[2]?.toString().trim();   // C열: 날짜
        const rowName = row[1]?.toString().trim();   // B열: 이름
        if (rowDate === today && rowName) {
          checkedToday.add(rowName);
        }
      }

      // 오늘 합주 기록이 3개 미만이면 실수 입력으로 간주 → 스킵
      if (checkedToday.size < 3) continue;

      // 출석체크 안 한 멤버 찾기
      const absentMembers = members.filter((name) => !checkedToday.has(name));

      if (absentMembers.length === 0) continue;

      // batchUpdate로 자동 결석 추가
      const requests: any[] = [];
      let currentRowCount = rows.length;

      for (const name of absentMembers) {
        requests.push({
          appendCells: {
            sheetId,
            rows: [
              {
                values: [
                  { userEnteredValue: { stringValue: song } },
                  { userEnteredValue: { stringValue: name } },
                  { userEnteredValue: { stringValue: today } },
                  { userEnteredValue: { stringValue: timeSlot } },
                  { userEnteredValue: { stringValue: '결석' } },
                  { userEnteredValue: { stringValue: '자동결석처리' } },
                  { userEnteredValue: { stringValue: submitDate } },
                  { userEnteredValue: { stringValue: submitClock } },
                ],
              },
            ],
            fields: '*',
          },
        });

        requests.push({
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: currentRowCount,
              endRowIndex: currentRowCount + 1,
              startColumnIndex: 0,
              endColumnIndex: 8,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 1, green: 0.8, blue: 0.8 },
              },
            },
            fields: 'userEnteredFormat.backgroundColor',
          },
        });

        currentRowCount++;
        results.push(`${song} - ${name} 자동결석 처리`);
      }

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });
    }

    return new Response(
      JSON.stringify({ message: '자동 결석 처리 완료', results }),
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ error: '자동 결석 처리 실패', detail: String(error) }),
      { status: 500 }
    );
  }
}
```