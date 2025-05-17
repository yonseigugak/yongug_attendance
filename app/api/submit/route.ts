import { google } from 'googleapis';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  /* =====================================================
     1. 요청 데이터 파싱
  ===================================================== */
  const body = await request.json();
  const { song, name, date, status, reason, timeSlot } = body;
  const songTrimmed = song.trim();
  console.log('📌 요청 데이터:', body);

  /* =====================================================
     2. 현재 시각 (KST) 및 제출 시간 문자열
  ===================================================== */
  const now = new Date();
  const currentDate = new Date(now.getTime() + 9 * 60 * 60 * 1000); // UTC → KST
  const submitDate = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}`;
  const submitClock = `${currentDate.getHours().toString().padStart(2, '0')}:${currentDate
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;

  /* =====================================================
     3. Google Sheets 인증 객체
  ===================================================== */
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEETS_SHEET_ID;
  const validSheets = ['취타', '축제', '미락흘', '도드리', '플투스'];
  if (!validSheets.includes(songTrimmed)) {
    return new Response(JSON.stringify({ error: '유효하지 않은 곡명입니다.' }), { status: 400 });
  }

  const range = `${songTrimmed}!A:H`;

  try {
    /* =====================================================
       4. 합주 시작 시각 및 출결 상태 판정
    ===================================================== */
    const [hourStr, minuteStr] = timeSlot.split(':');
    const startTimeUTC = new Date(`${date}T${hourStr.padStart(2, '0')}:${minuteStr.padStart(2, '0')}:00Z`);
    const startTime = new Date(startTimeUTC.getTime() + 9 * 60 * 60 * 1000); // KST

    const timeDiffMin = (currentDate.getTime() - startTime.getTime()) / (1000 * 60); // 분 단위

    let finalStatus = status;
    let backgroundColor;

    if (finalStatus === '고정결석계' || finalStatus === '일반결석계') {
      backgroundColor = { red: 0.8, green: 0.93, blue: 1 }; // 파랑
    } else if (finalStatus === '고정지각') {
      backgroundColor = { red: 0.9, green: 0.8, blue: 1 }; // 보라
    } else if (timeDiffMin <= 10) {
      finalStatus = '출석';
      backgroundColor = { red: 0.8, green: 1, blue: 0.8 }; // 초록
    } else if (timeDiffMin <= 40) {
      finalStatus = '지각';
      backgroundColor = { red: 1, green: 1, blue: 0.6 }; // 노랑
    } else {
      finalStatus = '결석';
      backgroundColor = { red: 1, green: 0.8, blue: 0.8 }; // 빨강
    }

    console.log('🕒 현재(KST):', currentDate.toString());
    console.log('🎯 합주 시작(KST):', startTime.toString());
    console.log('⏱️ 시간 차이(분):', timeDiffMin);
    console.log('📌 판정 결과:', finalStatus);

    /* =====================================================
       5. 시트 데이터 및 메타 한꺼번에 가져오기
    ===================================================== */
    const [valuesRes, metaRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId, range }),
      sheets.spreadsheets.get({ spreadsheetId, includeGridData: false, fields: 'sheets.properties' }),
    ]);

    const rows = valuesRes.data.values || [];
    const sheetId = metaRes.data.sheets?.find(s => s.properties?.title === songTrimmed)?.properties?.sheetId;
    if (sheetId === undefined) throw new Error('시트 ID를 찾을 수 없음');

    /* =====================================================
       6. "출석"이면 같은 날 결석계 삭제
    ===================================================== */
    let deletedCount = 0;
    if (finalStatus === '출석') {
      const deleteTargets: number[] = [];
      const absenceTypes = ['고정결석계', '일반결석계'];

      rows.forEach((row, idx) => {
        if (idx === 0) return; // 헤더
        const [, rName, rDate, rStatus] = row;
        if (rName?.trim() === name.trim() && rDate === date && absenceTypes.includes(rStatus)) {
          deleteTargets.push(idx);
        }
      });

      if (deleteTargets.length) {
        deletedCount = deleteTargets.length;
        deleteTargets.sort((a, b) => b - a); // 큰 행부터 삭제

        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: deleteTargets.map(idx => ({
              deleteDimension: {
                range: { sheetId, dimension: 'ROWS', startIndex: idx, endIndex: idx + 1 },
              },
            })),
          },
        });
        console.log(`🗑️ 삭제된 결석계 행: ${deleteTargets}`);
      }
    }

    /* =====================================================
       7. 새 행 위치 계산 후 데이터 추가
    ===================================================== */
    const nextRow = rows.length - deletedCount + 1; // 헤더 포함

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${songTrimmed}!A${nextRow}:G${nextRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[song, name, date, finalStatus, reason, submitDate, submitClock]],
      },
    });

    /* =====================================================
       8. 방금 쓴 행 배경색 지정
    ===================================================== */
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: nextRow - 1,
                endRowIndex: nextRow,
                startColumnIndex: 0,
                endColumnIndex: 7,
              },
              cell: { userEnteredFormat: { backgroundColor } },
              fields: 'userEnteredFormat.backgroundColor',
            },
          },
        ],
      },
    });

    return new Response(JSON.stringify({ message: '저장 및 스타일 설정 성공!' }), { status: 200 });
  } catch (err) {
    console.error('📌 Google Sheets API 에러:', err);
    return new Response(JSON.stringify({ error: '저장 실패!' }), { status: 500 });
  }
}
