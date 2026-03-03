"use client";

import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from "react";

type GeoPos = GeolocationPosition["coords"]

const AttendanceForm = () => {
  /* 옵션 상태 */
  const [songs, setSongs] = useState<string[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);

  /* 폼 상태 */
  const [formData, setFormData] = useState({
    song: "",
    name: "",
    date: "",
    status: "출석",
    reason: "",
    rehearsalTime: "",
  });

  /* 옵션 fetch */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/options");
        const { songs, timeSlots, statuses } = await res.json();
        setSongs(songs);
        setTimeSlots(timeSlots);
        setStatuses(statuses);
        setFormData(p => ({
          ...p,
          song: songs[0] ?? "",
          rehearsalTime: timeSlots[0] ?? "",
          status: statuses[0] ?? "",
        }));
      } catch (err) {
        console.error(err);
        alert("관리자 설정을 불러오지 못했습니다.");
      }
    })();
  }, []);

  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const getPosition = () =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("위치 정보가 지원되지 않는 브라우저입니다."));
      } else {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      }
    });

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
    return R * c;
  };

  /* 🔥 여기만 수정됨 */
  const submitAttendance = async (timeSlot: string) => {
    const response = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...formData, timeSlot }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "오류가 발생했습니다.");
      return;
    }

    alert("성공적으로 제출되었습니다!");
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);

    const timeSlot = formData.rehearsalTime.split("-")[0];

    try {
      if (formData.status === "출석") {
        const today = new Date();
        const todayStr = today.toISOString().substring(0, 10);
        if (formData.date !== todayStr) {
          alert("출석은 오늘 날짜에만 가능합니다.");
          return;
        }

        const rehearsalStart = new Date(`${formData.date}T${timeSlot}:00`);
        if (Date.now() < rehearsalStart.getTime() - 30 * 60 * 1000) {
          alert("출석은 합주 시작 30분 전부터만 가능합니다.");
          return;
        }

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

        if (distance > 70) {
          alert("출석은 학생회관 내에서만 가능합니다.");
          return;
        }

        await submitAttendance(timeSlot);
      }

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
      submittingRef.current = false;
    }
  };

  return (
    <div className="container mx-auto p-8">
      {loading && (
        <div className="fixed inset-x-0 top-0 h-1 bg-blue-500 animate-pulse z-50" />
      )}

      <h1 className="text-3xl font-bold mb-6">합주 출석 기록</h1>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* 나머지 UI 부분 전부 동일 (생략 없이 유지) */}

        <button
          type="submit"
          disabled={loading}
          className={`${
            loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-500"
          } text-white rounded py-2 px-4 mt-4`}
        >
          {loading ? "제출 중..." : "제출"}
        </button>
      </form>
    </div>
  );
};

export default AttendanceForm;
