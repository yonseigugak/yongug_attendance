import React, { useState } from 'react';

const Form = () => {
  const [song, setSong] = useState('');
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const timestamp = new Date().toLocaleString();

    const data = { song, name, date, status, reason, timestamp };

    const response = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (response.ok) alert('제출 완료!');
    else alert('오류 발생!');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <select value={song} onChange={e => setSong(e.target.value)} className="border p-2 w-full">
        <option value="">합주곡 선택</option>
        <option value="취타">취타</option>
        <option value="축제">축제</option>
        <option value="미락흘">미락흘</option>
        <option value="도드리">도드리</option>
        <option value="플투스">플투스</option>
      </select>

      <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="이름" />
      <input type="date" value={date} onChange={e => setDate(e.target.value)} />
      <select value={status} onChange={e => setStatus(e.target.value)}>
        <option value="">출결 상태</option>
        <option value="출석">출석</option>
        <option value="일반결석계">일반결석계</option>
        <option value="고정결석계">고정결석계</option>
      </select>
      <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="사유 (선택 사항)" />
      <button type="submit">제출</button>
    </form>
  );
};

export default Form;