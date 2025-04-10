import { google } from 'googleapis';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { song, name, date, status, reason, timeSlot } = body;

    const songTrimmed = song.trim();
    console.log("📌 요청으로 받은 데이터:", body);

    const currentDate = new Date();
    const formatter = new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Seoul'
      });
      
      // 한국 시간 기준으로 '2025-04-10 오전 2:17' 같은 포맷
      const submitTime = formatter.format(new Date());

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

    const range = `${songTrimmed}!A:F`;

    try {
        // ✅ 출결 상태 자동 판별 로직
        const [hourStr, minuteStr] = timeSlot.split(':');
      
        // 현재 시간 (KST 기준)
        const currentDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
      
        // 합주 시작 시간 (KST 기준)
        const startTimeString = `${date}T${hourStr.padStart(2, '0')}:${minuteStr.padStart(2, '0')}:00`;
        const startTime = new Date(new Date(startTimeString).toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
      
        // 시간 차이 계산
        const timeDiffMin = (currentDate.getTime() - startTime.getTime()) / (1000 * 60);
      
        // 🔧 한국 시간 기준으로 현재 시간 객체 생성
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));

        // 🔧 완전한 텍스트 형태로 제출 시간 생성
        const submitTime = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ` +
                   `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      
        let finalStatus = status;
        let backgroundColor;
      
        if (reason === '고정결석계' || reason === '일반결석계') {
          backgroundColor = { red: 0.8, green: 0.93, blue: 1 }; // 파란색
        } else if (timeDiffMin <= 15) {
          finalStatus = '출석';
          backgroundColor = { red: 0.8, green: 1, blue: 0.8 }; // 초록
        } else if (timeDiffMin > 15 && timeDiffMin <= 60) {
          finalStatus = '지각';
          backgroundColor = { red: 1, green: 1, blue: 0.6 }; // 노랑
        } else {
          finalStatus = '결석';
          backgroundColor = { red: 1, green: 0.8, blue: 0.8 }; // 빨강
        }

        // 🔍 기존 데이터 가져오기
        const getResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range });
        const rows = getResponse.data.values || [];
        const nextRow = rows.length + 1;

        const appendResponse = await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${songTrimmed}!A${nextRow}:F${nextRow}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[song, name, date, finalStatus, reason, submitTime]],
            },
        });

        // 🔤 시트 정규화
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
                                endColumnIndex: 6,
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
