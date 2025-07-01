"use client";

import { useState, useRef } from "react";

const AttendanceForm = () => {
  /* ─────────────────── state ─────────────────── */
  const [formData, setFormData] = useState({
    song: "취타",
    name: "",
    date: "",
    status: "출석",
    reason: "",
    rehearsalTime: "19:00-20:20",
  });
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);           // 연타 방지용 플래그

  /* ─────────────────── helpers ─────────────────── */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Geolocation → Promise 래핑
  const getPosition = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("위치 정보가 지원되지 않는 브라우저입니다."));
      } else {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      }
    });

  // Haversine 거리 계산
  const getDistance = (lat1, lon1, lat2, lon2) => {
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
  const submitAttendance = async (timeSlot) => {
    const response = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...formData, timeSlot }),
    });
    const result = await response.json();
    if (response.ok) {
      alert("성공적으로 제출되었습니다!");
    } else {
      alert(`오류 발생: ${result.message}`);
    }
  };

  /* ─────────────────── submit ─────────────────── */
  const handleSubmit = async (e) => {
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
        let coords;
        try {
          coords = (await getPosition()).coords;
        } catch (err) {
          alert(err.message);
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
      {/* 진행바: loading=true 이면 상단에 파랑 바가 흐름 */}
      {loading && <div className="fixed inset-x-0 top-0 h-1 bg-blue-500 animate-pulse z-50" />}

      <h1 className="text-3xl font-bold mb-6">합주 출석 기록</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">곡명</label>
          <select
            name="song"
            value={formData.song}
            onChange={handleChange}
            className="border border-gray-300 rounded p-2 w-full"
          >
            <option value="취타">취타</option>
            <option value="축제">축제</option>
            <option value="미락흘">미락흘</option>
            <option value="도드리">도드리</option>
            <option value="플투스">플투스</option>
          </select>
        </div>

        <div>
          <label className="block mb-1">합주 시간대</label>
          <select
            name="rehearsalTime"
            value={formData.rehearsalTime}
            onChange={handleChange}
            className="border border-gray-300 rounded p-2 w-full"
          >
            <option value="19:00-20:20">19:00-20:20</option>
            <option value="20:30-21:50">20:30-21:50</option>
            <option value="10:00-11:00">10:00-11:00</option>
            <option value="11:15-12:15">11:15-12:15</option>
            <option value="13:30-14:30">13:30-14:30</option>
            <option value="14:45-15:45">14:45-15:45</option>
            <option value="16:00-17:00">16:00-17:00</option>
          </select>
        </div>

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

        <button
          type="submit"
          disabled={loading}
          className={`${loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-500"} text-white rounded py-2 px-4 mt-4 flex items-center justify-center gap-2`}
        >
          {loading && (
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" />
            </svg>
          )}
          {loading ? "제출 중..." : "제출"}
        </button>
      </form>
    </div>
  );
};

export default AttendanceForm;
