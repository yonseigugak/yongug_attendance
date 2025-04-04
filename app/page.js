"use client";

import { useState } from 'react';

const AttendanceForm = () => {
  const [formData, setFormData] = useState({
    song: '취타',
    name: '',
    date: '',
    status: '출석',
    reason: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        alert('성공적으로 제출되었습니다!');
      } else {
        alert(`오류 발생: ${result.message}`);
      }
    } catch (error) {
      console.error('제출 중 오류 발생:', error);
      alert('제출 중 오류 발생');
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">합주 출석 기록</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">곡명</label>
          <select name="song" value={formData.song} onChange={handleChange} className="border border-gray-300 rounded p-2 w-full">
            <option value="취타">취타</option>
            <option value="축제">축제</option>
            <option value="미락흘">미락흘</option>
            <option value="도드리">도드리</option>
            <option value="플투스">플투스</option>
          </select>
        </div>

        <div>
          <label className="block mb-1">이름</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} className="border border-gray-300 rounded p-2 w-full" required />
        </div>

        <div>
          <label className="block mb-1">날짜</label>
          <input type="date" name="date" value={formData.date} onChange={handleChange} className="border border-gray-300 rounded p-2 w-full" required />
        </div>

        <div>
          <label className="block mb-1">출결 상태</label>
          <select name="status" value={formData.status} onChange={handleChange} className="border border-gray-300 rounded p-2 w-full">
            <option value="출석">출석</option>
            <option value="일반결석계">일반결석계</option>
            <option value="고정결석계">고정결석계</option>
          </select>
        </div>

        <div>
          <label className="block mb-1">사유 (선택)</label>
          <textarea name="reason" value={formData.reason} onChange={handleChange} className="border border-gray-300 rounded p-2 w-full"></textarea>
        </div>

        <button type="submit" className="bg-blue-500 text-white rounded py-2 px-4 mt-4">제출</button>
      </form>
    </div>
  );
};

export default AttendanceForm;
