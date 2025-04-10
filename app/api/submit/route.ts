import { google } from 'googleapis';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {

    const body = await request.json();
    const { song, name, date, status, reason } = body;

    const songTrimmed = song.trim()
    console.log("📌 요청으로 받은 데이터:", body);

    const currentDate = new Date();
    const submitTime = currentDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: "Asia/Seoul" });

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
        console.log("📌 Google Sheets API에 보내는 데이터:", [song, name, date, status, reason, submitTime]);

        // 🔍 기존 데이터를 가져오기
        const getResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        const rows = getResponse.data.values || [];
        const nextRow = rows.length + 1; // 기존 데이터의 다음 행에 저장하기

        // 🔄 데이터 덮어쓰기 방식으로 추가하기 (append 대신 update 사용)
        const appendResponse = await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${songTrimmed}!A${nextRow}:F${nextRow}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [
                    [song || "", name || "", date || "", status || "", reason || "", submitTime || ""]
                ],
            },
        });

        const updatedRange = appendResponse.data.updatedRange;

        if (!updatedRange) throw new Error("업데이트된 범위 정보를 찾을 수 없습니다.");

        const lastRow = nextRow;

        // ✅ 셀 배경색 설정하기
        const backgroundColor = status === '출석'
        ? { red: 0.8, green: 1, blue: 0.8 }
        : { red: 0.8, green: 0.93, blue: 1 };
    
        const sheetInfo = await sheets.spreadsheets.get({
            spreadsheetId,
            includeGridData: false, // 기본값이지만 명시해주는 것도 안정적
            fields: 'sheets.properties', // 💡 시트 ID를 포함한 모든 properties 반환 요청
        });
    
    // 🔤 유니코드 정규화 + 공백 제거
    const normalizeKorean = (str: string) => str.normalize("NFC").trim();
    
    // 📋 시트 제목 목록 출력
    const sheetTitles = sheetInfo.data.sheets?.map(sheet => sheet.properties?.title);
    console.log("📌 현재 스프레드시트 시트 목록:", sheetTitles);

    
    
    // 🧪 디버깅용 로그
    console.log("🎯 song.trim() =", JSON.stringify(normalizeKorean(song)));
    sheetInfo.data.sheets?.forEach(sheet => {
        const rawTitle = sheet.properties?.title || "";
        console.log("📄 sheet title =", JSON.stringify(normalizeKorean(rawTitle)));
        console.log("🔍 equals:", normalizeKorean(rawTitle) === normalizeKorean(song));
    });
    
    // ✅ 시트 찾기 (정규화 + 트림 기준)
    const targetSheet = sheetInfo.data.sheets?.find(sheet => {
        const rawTitle = sheet.properties?.title || "";
        return normalizeKorean(rawTitle) === normalizeKorean(song);
    });
    
    if (!targetSheet || targetSheet.properties?.sheetId === undefined) {
        throw new Error("해당 시트를 찾을 수 없습니다.");
    }

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [
                    {
                        repeatCell: {
                            range: {
                                sheetId: targetSheet.properties.sheetId,
                                startRowIndex: lastRow - 1,
                                endRowIndex: lastRow,
                                startColumnIndex: 0,
                                endColumnIndex: 6,
                            },
                            cell: {
                                userEnteredFormat: {
                                    backgroundColor: backgroundColor,
                                },
                            },
                            fields: 'userEnteredFormat.backgroundColor',
                        },
                    },
                ],
            },
        });

        console.log("📌 Google Sheets API 응답:", appendResponse.data);
        return new Response(JSON.stringify({ message: '저장 및 스타일 설정 성공!' }), { status: 200 });
    } catch (error) {
        console.error('📌 Google Sheets API 에러:', error);
        return new Response(JSON.stringify({ error: '저장 실패!' }), { status: 500 });
    }
}