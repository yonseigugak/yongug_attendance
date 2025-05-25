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

/* 0) 시트 메타 – sheetId 한 번만 구해둡니다 */
const meta = await sheets.spreadsheets.get({
  spreadsheetId,
  includeGridData: false,
  fields: 'sheets.properties',
});
const sheetId =
  meta.data.sheets?.find(s => s.properties?.title === songTrimmed)?.properties
    ?.sheetId;
if (sheetId === undefined) throw new Error('sheetId not found');

/* 1) 스냅숏 로딩 & “삭제 대상” 재확인 */
const range = `${songTrimmed}!A:I`;      // 8-컬럼(곡·이름·날짜·timeSlot·상태…)
const { data } = await sheets.spreadsheets.values.get({ spreadsheetId, range });
const rows = data.values ?? [];

const isAbsenceRow = (row: any[]) => {
  const [, rName, rDate, rTime, rStatus] = row;
  const timeMatch = !rTime || rTime === timeSlot;
  return rName?.trim() === name.trim() &&
         rDate === date &&
         timeMatch &&
         ['고정결석계','일반결석계'].includes(rStatus);
};

const deleteIdx = rows
  .map((row, i) => (i !== 0 && isAbsenceRow(row)) ? i : -1)  // 0 = 헤더
  .filter(i => i > 0)
  .sort((a,b) => b - a);          // 큰 행부터 (행 밀림 방지)

/* 2) append + delete + 색칠을 ‘한 번의 batchUpdate’로 원자 처리 */
const requests: any[] = [];

/* 2-a) appendCells */
requests.push({
  appendCells: {
    sheetId,
    rows: [{
      values: [
        {userEnteredValue:{stringValue:song}},
        {userEnteredValue:{stringValue:name}},
        {userEnteredValue:{stringValue:date}},
        {userEnteredValue:{stringValue:timeSlot}},          // 🔑 새 컬럼
        {userEnteredValue:{stringValue:finalStatus}},
        {userEnteredValue:{stringValue:reason}},
        {userEnteredValue:{stringValue:submitDate}},
        {userEnteredValue:{stringValue:submitClock}},
      ],
    }],
    fields: '*',
  },
});

/* 2-b) deleteDimension(필요할 때만) */
deleteIdx.forEach(idx => {
  requests.push({
    deleteDimension: {
      range: { sheetId, dimension:'ROWS', startIndex:idx, endIndex:idx+1 },
    },
  });
});

/* 2-c) repeatCell – 방금 append된 맨 마지막 행에 색칠
   ( batch 안에서는 append 가 먼저 실행되므로 startRowIndex = rows.length )
*/
requests.push({
  repeatCell: {
    range: {
      sheetId,
      startRowIndex: rows.length,    // 기존 rows 길이 = 새 행의 0-based 인덱스
      endRowIndex:   rows.length+1,
      startColumnIndex: 0,
      endColumnIndex: 8,             // A:I
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
  JSON.stringify({ message:'저장·삭제·색칠 원자처리 완료!' }),
  { status:200 },
);
  } catch (error) {
    console.error('📌 Google Sheets API 에러:', error);
    return new Response(JSON.stringify({ error: '저장 실패!' }), { status: 500 });
  }
}
