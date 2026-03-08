"use client";

import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from "react";

type GeoPos = GeolocationPosition["coords"];

const AttendanceForm = () => {

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
      try {
        const res = await fetch("/api/options");
        const { songs, timeSlots, statuses } = await res.json();

        setSongs(songs ?? []);
        setTimeSlots(timeSlots ?? []);
        setStatuses(statuses ?? []);

        setFormData((p) => ({
          ...p,
          song: songs?.[0] ?? "",
          rehearsalTime: timeSlots?.[0] ?? "",
          status: statuses?.[0] ?? "출석",
        }));
      } catch (err) {
        console.error(err);
        alert("관리자 설정을 불러오지 못했습니다.");
      }
    })();
  }, []);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const submitAttendance = async (timeSlot: string) => {

    if (formData.status === "일반결석계" && generalAbsentUsed >= 4) {
      alert("일반결석계는 곡당 최대 4회까지 사용 가능합니다.");
      return;
    }

    const response = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...formData, timeSlot }),
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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);

    const timeSlot = formData.rehearsalTime.split("-")[0];

    try {
      await submitAttendance(timeSlot);
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className="container mx-auto p-8">

      <h1 className="text-3xl font-bold mb-6">합주 출석 기록</h1>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* 곡 선택 */}
        <div>
          <label className="block mb-1 font-medium">곡</label>
          <select
            name="song"
            value={formData.song}
            onChange={handleChange}
            className="border rounded p-2 w-full"
          >
            {songs.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* 이름 */}
        <div>
          <label className="block mb-1 font-medium">이름</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="border rounded p-2 w-full"
          />
        </div>

        {/* 날짜 */}
        <div>
          <label className="block mb-1 font-medium">날짜</label>
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
            className="border rounded p-2 w-full"
          />
        </div>

        {/* 합주 시간 */}
        <div>
          <label className="block mb-1 font-medium">합주 시간</label>
          <select
            name="rehearsalTime"
            value={formData.rehearsalTime}
            onChange={handleChange}
            className="border rounded p-2 w-full"
          >
            {timeSlots.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* 출결 상태 */}
        <div>
          <label className="block mb-1 font-medium">출결 상태</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="border rounded p-2 w-full"
          >
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* 사유 */}
        {formData.status !== "출석" && (
          <div>
            <label className="block mb-1 font-medium">사유</label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              className="border rounded p-2 w-full"
            />
          </div>
        )}

        {/* 일반결석계 사용 횟수 표시 */}
        {formData.status === "일반결석계" && (
          <div className="text-sm text-red-600">
            현재 사용 횟수: {generalAbsentUsed} / 4회
            {generalAbsentUsed >= 4 && (
              <span className="ml-2 font-bold">
                (최대 사용 횟수를 초과했습니다)
              </span>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`${loading ? "bg-gray-400" : "bg-blue-500"} text-white rounded py-2 px-4`}
        >
          {loading ? "제출 중..." : "제출"}
        </button>

      </form>
    </div>
  );
};

export default AttendanceForm;