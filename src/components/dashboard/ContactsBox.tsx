'use client';

import React, { useState, useMemo } from 'react';
import { useContacts } from '@/hooks/useContacts';
import { BookOpen, UserPlus, Search, Phone, Mail, FileText, Trash2, ShieldAlert } from 'lucide-react';

export const ContactsBox: React.FC = () => {
  const { contacts, loading, addContact, deleteContact } = useContacts();

  // 검색 상태
  const [searchTerm, setSearchTerm] = useState('');

  // 폼 등록 상태
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 검색 필터링 적용 목록
  const filteredContacts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.phone.toLowerCase().includes(term) ||
        (c.notes && c.notes.toLowerCase().includes(term))
    );
  }, [contacts, searchTerm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('이름/노드명을 입력해주세요.');
      return;
    }
    if (!phone.trim()) {
      setError('연락처 번호를 입력해주세요.');
      return;
    }

    addContact({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      notes: notes.trim()
    });

    // Reset fields
    setName('');
    setPhone('');
    setEmail('');
    setNotes('');
  };

  return (
    <div className="glass-panel rounded-[2rem] p-8 shadow-2xs border border-white/20 transition-all duration-300 hover:shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200/50 pb-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-2xl border border-emerald-500/15">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-800 tracking-tight">내 연락처 및 주소록 관리</h4>
            <p className="text-xs font-semibold text-slate-450 mt-0.5">실무 협업자 및 마인드맵 공약제안 노드별 연락 정보를 관리합니다. (E2EE 암호화 저장)</p>
          </div>
        </div>
        <span className="text-[11px] font-semibold px-3 py-1 bg-emerald-500/10 border border-emerald-500/15 text-emerald-600 rounded-full shadow-3xs">
          총 {contacts.length}명
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Container (left side) */}
        <form onSubmit={handleSubmit} className="lg:col-span-4 flex flex-col gap-4 bg-slate-55/20 p-6 rounded-2xl border border-slate-200/40 backdrop-blur-xs">
          <span className="text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-emerald-500" /> 신규 연락처 추가
          </span>

          {error && (
            <div className="flex items-center gap-2 text-xs font-bold bg-rose-500/10 text-rose-605 p-3 rounded-xl border border-rose-500/20">
              <ShieldAlert className="w-4.5 h-4.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-505">이름 / 노드명</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 최장미 (홍보 담당)"
              className="w-full px-4.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-350 placeholder:font-semibold"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-500">연락처 (전화번호)</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="예: 02-2133-9480"
              className="w-full px-4.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-350 placeholder:font-semibold"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-500">이메일 주소 (선택)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="예: email@example.com"
              className="w-full px-4.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-350 placeholder:font-semibold"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-505">비고 / 메모 (선택)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="예: 보건소 홍보물 기획 담당"
              className="w-full px-4.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-350 placeholder:font-semibold"
            />
          </div>

          <button
            type="submit"
            className="w-full mt-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10 active:scale-[0.98]"
          >
            연락처 저장
          </button>
        </form>

        {/* Contacts List (right side) */}
        <div className="lg:col-span-8 flex flex-col min-w-0">
          {/* Search bar */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="이름, 전화번호, 비고 키워드로 주소록 검색..."
              className="w-full pl-11 pr-4.5 py-3 rounded-2xl border border-slate-200/60 text-sm font-semibold text-slate-700 bg-white/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-450"
            />
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mb-3" />
              <p className="text-xs font-bold">주소록 데이터를 불러오고 있습니다...</p>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white/30 border border-dashed border-slate-200 rounded-2xl">
              <BookOpen className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-sm font-bold text-slate-450">검색 결과 또는 등록된 연락처가 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[440px] overflow-y-auto pr-2 scrollbar-thin">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="group relative flex flex-col p-4.5 bg-white/40 border border-slate-200/50 hover:border-emerald-500/40 rounded-2xl transition-all duration-200 hover:shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-bold text-slate-800 tracking-tight truncate max-w-[170px]">
                      {contact.name}
                    </span>
                    <button
                      onClick={() => {
                        if (confirm(`'${contact.name}' 연락처를 삭제하시겠습니까?`)) {
                          deleteContact(contact.id);
                        }
                      }}
                      className="p-1.5 text-slate-350 hover:text-rose-600 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-1.5 mt-3 text-xs font-semibold text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {contact.phone}
                    </span>
                    {contact.email && (
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {contact.email}
                      </span>
                    )}
                    {contact.notes && (
                      <span className="flex items-start gap-1.5 text-slate-500 mt-0.5 border-t border-slate-200/40 pt-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-450 shrink-0 mt-0.5" />
                        <span className="leading-relaxed break-all">{contact.notes}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
