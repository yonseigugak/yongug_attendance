"use client";

import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from "react";

type GeoPos = GeolocationPosition["coords"];

export default function AttendanceForm() {

  const [songs, setSongs] = useState<string[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [generalAbsentUsed, setGeneralAbsentUsed] = useState<number>(0);

  const [formData, setFormData] = useState({
    song: "",
    name: "",
    date: "",
    status: "출석",
    reason: "",
    rehearsalTime: "",
  });

  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/options");
      const data = await res.json();

      setSongs(data.songs);
      setTimeSlots(data.timeSlots);
      setStatuses(data.statuses);

      setFormData((p) => ({
        ...p,
        song: data.songs[0],
        rehearsalTime: data.timeSlots[0],
        status: data.statuses[0],
      }));
    })();
  }, []);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {

    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const getPosition = () =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject);
    });

  const getDistance = (lat1:number, lon1:number, lat2:number, lon2:number) => {

    const R = 6371e3;

    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;

    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a =
      Math.sin(Δφ / 2) ** 2 +
      Math.cos(φ1) *
      Math.cos(φ2) *
      Math.sin(Δλ / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const submitAttendance = async (timeSlot:string) => {

    const response = await fetch("/api/submit", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ ...formData, timeSlot })
    });

    const result = await response.json();

    if (!response.ok) {

      alert(result.error || "오류가 발생했습니다.");

      if (typeof result.generalAbsentUsed === "number") {
        setGeneralAbsentUsed(result.generalAbsentUsed);
      }

      return;
    }

    if (typeof result.generalAbsentUsed === "number") {
      setGeneralAbsentUsed(result.generalAbsentUsed);
    }

    alert("성공적으로 제출되었습니다!");
  };

  const handleSubmit = async (e:FormEvent<HTMLFormElement>) => {

    e.preventDefault();

    if (submittingRef.current) return;

    submittingRef.current = true;

    setLoading(true);

    const timeSlot = formData.rehearsalTime.split("-")[0];

    try {

      if (formData.status === "일반결석계" && generalAbsentUsed >= 4) {
        alert("일반결석계는 곡당 최대 4회까지 사용 가능합니다.");
        return;
      }

      if (formData.status === "출석") {

        const today = new Date();
        const todayStr = today.toISOString().substring(0,10);

        if (formData.date !== todayStr) {
          alert("출석은 오늘 날짜에만 가능합니다.");
          return;
        }

        const rehearsalStart =
          new Date(`${formData.date}T${timeSlot}:00`);

        if (Date.now() < rehearsalStart.getTime() - 30*60*1000) {
          alert("출석은 합주 시작 30분 전부터만 가능합니다.");
          return;
        }

        const targetLat = 37.5635;
        const targetLng = 126.9383;

        const coords = (await getPosition()).coords;

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

      } else {

        const rehearsalStart =
          new Date(`${formData.date}T${timeSlot}:00`);

        if (Date.now() >= rehearsalStart.getTime()) {
          alert("결석계는 합주 시작 이전까지만 제출 가능합니다.");
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

      <h1 className="text-3xl font-bold mb-6">
        합주 출석 기록
      </h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >

        <div>
          <label className="block">곡</label>
          <select
            name="song"
            value={formData.song}
            onChange={handleChange}
          >
            {songs.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block">이름</label>
          <input
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label className="block">날짜</label>
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label className="block">합주 시간</label>
          <select
            name="rehearsalTime"
            value={formData.rehearsalTime}
            onChange={handleChange}
          >
            {timeSlots.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block">출결 상태</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
          >
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        {formData.status !== "출석" && (
          <div>
            <label className="block">사유</label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
            />
          </div>
        )}

        {formData.status === "일반결석계" && (
          <div className="text-sm text-red-600">
            현재 사용 횟수: {generalAbsentUsed} / 4회
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-500 text-white rounded py-2 px-4 mt-4"
        >
          {loading ? "제출 중..." : "제출"}
        </button>

      </form>

    </div>
  );
}