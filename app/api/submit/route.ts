import { google } from 'googleapis';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { song, name, date, status, reason, timeSlot } = body;

  const songTrimmed = song.trim();
  const nameTrimmed = name.trim();

  const now = new Date();
  const currentDate = new Date(now.getTime() + 9 * 60 * 60 * 1000); // KST

  const submitDate = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}`;

  const submitClock = `${currentDate
    .getHours()
    .toString()
    .padStart(2, '0')}:${currentDate
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEETS_SHEET_ID;

  try {
    /* sheetId 찾기 */
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      includeGridData: false,
      fields: 'sheets.properties',
    });

    const sheetId =
      meta.data.sheets?.find(
        (s) => s.properties?.title === songTrimmed
      )?.properties?.sheetId;

    if (sheetId === undefined) throw new Error('sheetId not found');

    /* 기존 rows 불러오기 */
    const range = `${songTrimmed}!A:K`;
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = data.values ?? [];

    /* 기존 사용 횟수 계산 */
    const generalLateUsed = rows.filter((row) => {
      return (
        row[1]?.toString().trim() === nameTrimmed &&
        row[4]?.toString().trim() === '일반지각계'
      );
    }).length;

    const generalAbsentUsed = rows.filter((row) => {
      return (
        row[1]?.toString().trim() === nameTrimmed &&
        row[4]?.toString().trim() === '일반결석계'
      );
    }).length;

    /* 4회 제한 체크 */
    if (status === '일반지각계' && generalLateUsed >= 4) {
      return new Response(
        JSON.stringify({
          error: '일반지각계는 곡당 최대 4회까지 가능합니다.',
          generalLateUsed,
          generalAbsentUsed,
        }),
        { status: 400 }
      );
    }

    if (status === '일반결석계' && generalAbsentUsed >= 4) {
      return new Response(
        JSON.stringify({
          error: '일반결석계는 곡당 최대 4회까지 가능합니다.',
          generalLateUsed,
          generalAbsentUsed,
        }),
        { status: 400 }
      );
    }

    /* 합주 시작 시간 계산 */
    const [hourStr, minuteStr] = timeSlot.split(':');

    const startTimeUTC = new Date(
      `${date}T${hourStr.padStart(2, '0')}:${minuteStr.padStart(
        2,
        '0'
      )}:00Z`
    );

    const startTime = new Date(startTimeUTC.getTime() + 9 * 60 * 60 * 1000);

    const timeDiffMin =
      (currentDate.getTime() - startTime.getTime()) / (1000 * 60);

    let finalStatus = status;
    let backgroundColor;

    /* 수동 선택 우선 처리 */
    if (status === '고정지각') {
      finalStatus = '고정지각';
      backgroundColor = { red: 0.9, green: 0.8, blue: 1 };
    } else if (status === '일반지각계') {
      finalStatus = '일반지각계';
      backgroundColor = { red: 0.8, green: 0.93, blue: 1 };
    } else if (status === '일반결석계') {
      finalStatus = '일반결석계';
      backgroundColor = { red: 0.8, green: 0.93, blue: 1 };
    } else {
      /* 자동 판정 */
      if (timeDiffMin <= 5) {
        finalStatus = '출석';
        backgroundColor = { red: 0.8, green: 1, blue: 0.8 };
      } else if (timeDiffMin <= 15) {
        finalStatus = '지각';
        backgroundColor = { red: 1, green: 1, blue: 0.6 };
      } else {
        finalStatus = '결석';
        backgroundColor = { red: 1, green: 0.8, blue: 0.8 };
      }
    }

    /* batchUpdate */
    const requests: any[] = [];

    requests.push({
      appendCells: {
        sheetId,
        rows: [
          {
            values: [
              { userEnteredValue: { stringValue: songTrimmed } },
              { userEnteredValue: { stringValue: nameTrimmed } },
              { userEnteredValue: { stringValue: date } },
              { userEnteredValue: { stringValue: timeSlot } },
              { userEnteredValue: { stringValue: finalStatus } },
              { userEnteredValue: { stringValue: reason || '' } },
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
          startRowIndex: rows.length,
          endRowIndex: rows.length + 1,
          startColumnIndex: 0,
          endColumnIndex: 8,
        },
        cell: { userEnteredFormat: { backgroundColor } },
        fields: 'userEnteredFormat.backgroundColor',
      },
    });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });

    return new Response(
      JSON.stringify({
        message: '저장 완료!',
        finalStatus,
        generalLateUsed: status === '일반지각계'
          ? generalLateUsed + 1
          : generalLateUsed,
        generalAbsentUsed: status === '일반결석계'
          ? generalAbsentUsed + 1
          : generalAbsentUsed,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ error: '저장 실패!' }),
      { status: 500 }
    );
  }
}