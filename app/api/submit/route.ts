import { google } from 'googleapis';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { song, name, date, status, reason, timeSlot } = body;

  const songTrimmed = song.trim();
  console.log("📌 요청으로 받은 데이터:", body);

  // ✅ 현재 시간 (KST = UTC + 9시간)
  const now = new Date();
  const currentDate = new Date(now.getTime() + 9 * 60 * 60 * 1000); // KST 기준 현재 시간

  // ✅ 제출 시간 문자열
  const submitDate = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}`;
  const submitClock = `${currentDate.getHours().toString().padStart(2, '0')}:${currentDate.getMinutes().toString().padStart(2, '0')}`;

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
    // ✅ 합주 시작 시간 (KST = UTC + 9시간)
    const [hourStr, minuteStr] = timeSlot.split(':');
    const startTimeUTC = new Date(`${date}T${hourStr.padStart(2, '0')}:${minuteStr.padStart(2, '0')}:00Z`);
    const startTime = new Date(startTimeUTC.getTime() + 9 * 60 * 60 * 1000);

    const timeDiffMin = (currentDate.getTime() - startTime.getTime()) / (1000 * 60) + 540;

    // ✅ 출결 상태 및 배경색 결정
    let finalStatus = status;
    let backgroundColor;

    if (finalStatus === '고정결석계' || finalStatus === '일반결석계') {
      backgroundColor = { red: 0.8, green: 0.93, blue: 1 }; // 파란색
    } else if (finalStatus === '고정지각') {
      backgroundColor = {red : 0.9, green: 0.8, blue: 1}; // 보라색
    } else if (timeDiffMin <= 10) {
      finalStatus = '출석';
      backgroundColor = { red: 0.8, green: 1, blue: 0.8 }; // 초록
    } else if (timeDiffMin > 10 && timeDiffMin <= 40) {
      finalStatus = '지각';
      backgroundColor = { red: 1, green: 1, blue: 0.6 }; // 노랑
    } else {
      finalStatus = '결석';
      backgroundColor = { red: 1, green: 0.8, blue: 0.8 }; // 빨강
    }

    // ✅ 디버깅 로그
    console.log("🕒 현재 시간:", currentDate.toString());
    console.log("🎯 합주 시작 시간:", startTime.toString());
    console.log("⏱️ 시간 차이 (분):", timeDiffMin);
    console.log("📌 최종 출결 상태:", finalStatus);

// ✅ 기존 데이터 불러오기
const getResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range });
const rows = getResponse.data.values || [];

/* ──────────────────────────────────────────────
   ❶ 출석이면 같은 날짜·이름의 결석계 삭제
────────────────────────────────────────────── */
let deletedCount = 0;
if (finalStatus === '출석' || finalStatus === '지각' || finalStatus === '결석') {
  const absenceTypes = ['고정결석계', '일반결석계'];
  const deleteTargets: number[] = [];

  rows.forEach((row, i) => {
    if (i === 0) return;                     // 헤더 스킵
    const [, rName, rDate, rStatus] = row;   // A열=곡명이므로 B~D 열 확인
    if (
      rName?.trim() === name.trim() &&
      rDate === date &&
      absenceTypes.includes(rStatus)
    ) {
      deleteTargets.push(i);                 // 0-based index
    }
  });

  if (deleteTargets.length) {
    deletedCount = deleteTargets.length;
    deleteTargets.sort((a, b) => b - a);     // 큰 행부터 지움

    // 시트 ID는 뒤에서 색칠할 때도 필요하니 한 번만 구해 둡니다
    const sheetMeta = await sheets.spreadsheets.get({
      spreadsheetId,
      includeGridData: false,
      fields: 'sheets.properties',
    });
    const sheetId =
      sheetMeta.data.sheets?.find(s => s.properties?.title === songTrimmed)
        ?.properties?.sheetId;
    if (sheetId === undefined) throw new Error('시트 ID를 찾을 수 없음');

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
  }
}

/* ──────────────────────────────────────────────
   ❷ 삭제 건수를 반영해 nextRow 계산
────────────────────────────────────────────── */
const nextRow = rows.length - deletedCount + 1;  // 헤더 포함

    // ✅ 데이터 저장
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${songTrimmed}!A${nextRow}:G${nextRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[song, name, date, finalStatus, reason, submitDate, submitClock]],
      },
    });

    // ✅ 시트 ID 찾기
    const normalizeKorean = (str: string) => str.normalize("NFC").trim();
    const sheetInfo = await sheets.spreadsheets.get({
      spreadsheetId,
      includeGridData: false,
      fields: 'sheets.properties',
    });

    const targetSheet = sheetInfo.data.sheets?.find(sheet =>
      normalizeKorean(sheet.properties?.title || '') === normalizeKorean(song)
    );

    if (!targetSheet || targetSheet.properties?.sheetId === undefined) {
      throw new Error("해당 시트를 찾을 수 없습니다.");
    }

    const sheetId = targetSheet.properties.sheetId;

    // ✅ 셀 배경색 설정
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
              cell: {
                userEnteredFormat: { backgroundColor },
              },
              fields: 'userEnteredFormat.backgroundColor',
            },
          },
        ],
      },
    });

    return new Response(JSON.stringify({ message: '저장 및 스타일 설정 성공!' }), { status: 200 });
  } catch (error) {
    console.error('📌 Google Sheets API 에러:', error);
    return new Response(JSON.stringify({ error: '저장 실패!' }), { status: 500 });
  }
}
