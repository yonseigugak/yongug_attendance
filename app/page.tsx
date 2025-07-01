"use client";

import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from "react";

type GeoPos = GeolocationPosition["coords"]

const AttendanceForm = () => {
  /* 옵션 상태 */
  const [songs, setSongs] = useState<string[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);

  /* 폼 상태 */
  const [formData, setFormData] = useState({
    song: "" as string,            // ← 기본값 비움
    name: "",
    date: "",
    status: "출석",
    reason: "",
    rehearsalTime: "" as string,
  });

  /* 옵션 fetch */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/options");
        const { songs, timeSlots } = (await res.json()) as {
            songs: string[];
            timeSlots: string[];
        };
        setSongs(songs);
        setTimeSlots(timeSlots);
        setFormData(p => ({
          ...p,
          song: songs[0] ?? "",
          rehearsalTime: timeSlots[0] ?? "",
        }));
      } catch (err) {
        console.error(err);
        alert("관리자 설정을 불러오지 못했습니다.");
      }
    })();
  }, []);

  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);           // 연타 방지용 플래그

  /* ─────────────────── helpers ─────────────────── */
  const handleChange = (
    e: ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Geolocation → Promise 래핑
  const getPosition = () =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("위치 정보가 지원되지 않는 브라우저입니다."));
      } else {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      }
    });

  // Haversine 거리 계산
  const getDistance = (lat1:number, lon1:number, lat2:number, lon2:number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // meters
  };

  // 서버 제출
  const submitAttendance = async (timeSlot:string) => {
    const response = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...formData, timeSlot }),
    });
    const { message } = (await response.json()) as {message: string};
    response.ok ? alert("성공적으로 제출되었습니다!") : alert(`오류 발생: ${message}`);
  };

  /* ─────────────────── submit ─────────────────── */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (submittingRef.current) return;   // 🔒 이미 제출 중
    submittingRef.current = true;
    setLoading(true);

    const timeSlot = formData.rehearsalTime.split("-")[0];

    try {
      /* ───── 출석 ───── */
      if (formData.status === "출석") {
        // 날짜 = 오늘?
        const today = new Date();
        const todayStr = today.toISOString().substring(0, 10);
        if (formData.date !== todayStr) {
          alert("출석은 오늘 날짜에만 가능합니다.");
          return;
        }

        // 합주 30분 전까지만 허용 (필요하면 주석 해제)
        /*
        const rehearsalStart = new Date(`${formData.date}T${timeSlot}:00`);
        if (Date.now() < rehearsalStart.getTime() - 30 * 60 * 1000) {
          alert("출석은 합주 시작 30분 전부터만 가능합니다.");
          return;
        }
        */

        // 위치 제한
        const targetLat = 37.5635;
        const targetLng = 126.9383;
        let coords: GeoPos;
        try {
          coords = (await getPosition()).coords;
        } catch (err: unknown) {
          alert(err instanceof Error ? err.message : String(err));
          return;
        }
        const distance = getDistance(
          coords.latitude,
          coords.longitude,
          targetLat,
          targetLng
        );
        if (distance > 200) {
          alert("출석은 학생회관 내에서만 가능합니다.");
          return;
        }

        // 🔗 서버로 제출
        await submitAttendance(timeSlot);
      }

      /* ───── 결석계 ───── */
      else {
        const rehearsalStart = new Date(`${formData.date}T${timeSlot}:00`);
        if (Date.now() >= rehearsalStart.getTime()) {
          alert("결석계는 합주 시작 시각 이전까지만 제출 가능합니다.");
          return;
        }
        await submitAttendance(timeSlot);
      }
    } finally {
      setLoading(false);
      submittingRef.current = false;   // 🔓 잠금 해제 (모든 비동기 종료 후)
    }
  };

  return (
    <div className="container mx-auto p-8">
      {/* 진행바 */}
      {loading && (
        <div className="fixed inset-x-0 top-0 h-1 bg-blue-500 animate-pulse z-50" />
      )}

      <h1 className="text-3xl font-bold mb-6">합주 출석 기록</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ────────── 곡명 ────────── */}
        <div>
          <label className="block mb-1">곡명</label>
          <select
            name="song"
            value={formData.song}
            onChange={handleChange}
            className="border border-gray-300 rounded p-2 w-full"
            disabled={songs.length === 0}            // 옵션 로딩 전 비활성화
            required
          >
            {songs.length === 0 ? (
              <option>로딩 중...</option>
            ) : (
              songs.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))
            )}
          </select>
        </div>

        {/* ────────── 합주 시간대 ────────── */}
        <div>
          <label className="block mb-1">합주 시간대</label>
          <select
            name="rehearsalTime"
            value={formData.rehearsalTime}
            onChange={handleChange}
            className="border border-gray-300 rounded p-2 w-full"
            disabled={timeSlots.length === 0}
            required
          >
            {timeSlots.length === 0 ? (
              <option>로딩 중...</option>
            ) : (
              timeSlots.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))
            )}
          </select>
        </div>

        {/* ────────── 나머지 필드 그대로 ────────── */}
        <div>
          <label className="block mb-1">이름</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="border border-gray-300 rounded p-2 w-full"
            required
          />
        </div>

        <div>
          <label className="block mb-1">날짜</label>
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            className="border border-gray-300 rounded p-2 w-full"
            required
          />
        </div>

        <div>
          <label className="block mb-1">출결 상태</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="border border-gray-300 rounded p-2 w-full"
          >
            <option value="출석">출석</option>
            <option value="일반결석계">일반결석계</option>
          </select>
        </div>

        <div>
          <label className="block mb-1">결석/지각 사유 및 지각 시간</label>
          <textarea
            name="reason"
            value={formData.reason}
            onChange={handleChange}
            className="border border-gray-300 rounded p-2 w-full"
          />
        </div>

        {/* ────────── 제출 버튼 ────────── */}
        <button
          type="submit"
          disabled={loading || songs.length === 0 || timeSlots.length === 0}
          className={`${
            loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-500"
          } text-white rounded py-2 px-4 mt-4 flex items-center justify-center gap-2`}
        >
          {loading && (
            <svg
              className="h-5 w-5 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                fill="currentColor"
              />
            </svg>
          )}
          {loading ? "제출 중..." : "제출"}
        </button>
      </form>
    </div>
    );
};

export default AttendanceForm;
