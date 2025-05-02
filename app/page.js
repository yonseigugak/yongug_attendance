"use client";

import { useState } from "react";

const AttendanceForm = () => {
  const [formData, setFormData] = useState({
    song: "취타",
    name: "",
    date: "",
    status: "출석",
    reason: "",
    rehearsalTime: "19:00-20:20",
  });

  // ⏳ 로딩 상태
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // 중복 클릭 방지
    setLoading(true);

    const timeSlot = formData.rehearsalTime.split("-")[0];

    try {
      if (formData.status === "출석") {
        // 🔒 오늘 날짜 체크
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");
        const todayStr = `${yyyy}-${mm}-${dd}`;

        if (formData.date !== todayStr) {
          alert("출석은 오늘 날짜에만 가능합니다.");
          return;
        }

        // ⏱ 합주 시작 30분 전부터만 허용
        const rehearsalStartTime = new Date(`${formData.date}T${timeSlot}:00`);
        const now = new Date();
        const earliestAllowed = new Date(rehearsalStartTime.getTime() - 30 * 60 * 1000);

        if (now < earliestAllowed) {
          alert("출석은 합주 시작 30분 전부터만 가능합니다.");
          return;
        }

        // ⛳ 위치 제한 (출석만)
        const targetLat = 37.5635;
        const targetLng = 126.9383;

        if (!navigator.geolocation) {
          alert("위치 정보가 지원되지 않는 브라우저입니다.");
          return;
        }

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            const distance = getDistance(latitude, longitude, targetLat, targetLng);

            if (distance > 60) {
              alert("출석은 학생회관 내에서만 가능합니다.");
              return;
            }

            await submitAttendance(timeSlot);
          },
          (error) => {
            alert("위치 정보를 가져오지 못했습니다.");
            console.error(error);
          }
        );
      } else {
        // 결석계/고정지각 등 날짜 무관
        await submitAttendance(timeSlot);
      }
    } finally {
      setLoading(false);
    }
  };

  const submitAttendance = async (timeSlot) => {
    const response = await fetch("/api/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...formData,
        timeSlot,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      alert("성공적으로 제출되었습니다!");
    } else {
      alert(`오류 발생: ${result.message}`);
    }
  };

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // 지구 반지름 (미터)
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // 미터 단위 거리 반환
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
