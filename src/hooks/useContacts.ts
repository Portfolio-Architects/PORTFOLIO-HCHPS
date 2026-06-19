'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useGoogleSheet, useSheetCrud } from './useGoogleSheet';
import { Contact, generateId } from '@/types';
import { replaceAll } from '@/lib/sheets-api';

const SEED_CONTACTS: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { name: '바른자세개선', phone: '01079353095', email: '', notes: '노드 ID: custom-1775195030946' },
  { name: '조성호', phone: '02-2133-9480', email: '', notes: '노드 ID: custom-1775022780402' },
  { name: '최장미', phone: '02-2133-9480', email: '', notes: '노드 ID: custom-1775022783410' },
  { name: '김민욱', phone: '0221337517, 01098734873', email: '', notes: '노드 ID: custom-1775785898357' },
  { name: '공간 디자인 및 리플릿', phone: '027565174, 01032007895', email: '', notes: '노드 ID: custom-1776086744704' },
  { name: '관악구', phone: '028797122', email: '', notes: '노드 ID: custom-1779952260703' },
  { name: '유승우', phone: '010-4377-9670', email: 'seungwooseungwoo1986@gmail.com', notes: '노드 ID: custom-1775102624256' },
  { name: '이정원', phone: '010-3358-0304', email: '', notes: '노드 ID: custom-1775102877754' },
  { name: '이현탁', phone: '01022659559', email: '', notes: '노드 ID: custom-1777353067240' },
  { name: '롯데이커머스', phone: '010 9799 6065', email: '', notes: '노드 ID: custom-1775784975907' },
  { name: '최수진', phone: '010-9688-0748', email: '', notes: '노드 ID: custom-1775102912460' },
  { name: '세브란스', phone: '02-2259-3208', email: '', notes: '노드 ID: custom-1780040446819' },
  { name: 'A and F', phone: '010-3200-7895', email: '', notes: '노드 ID: custom-1776132806359' },
  { name: '시드테크', phone: '01079249151', email: '', notes: '노드 ID: custom-1775796286144' },
  { name: '건보강남동부지사', phone: '0234590135', email: '', notes: '노드 ID: custom-1778217576701' },
  { name: '강윤건 매니저님', phone: '01095051019', email: '', notes: '노드 ID: custom-1776139882849' },
  { name: '김만중', phone: '0221828966, 01091631743', email: '', notes: '노드 ID: custom-1779858554480' }
];

export function useContacts() {
  const [contacts, setContacts, loading] = useGoogleSheet<Contact>(
    'CONTACTS',
    'hchps-contacts',
    []
  );
  const { syncAdd, syncUpdate, syncDelete } = useSheetCrud<Contact>('CONTACTS');
  const seedingTriggered = useRef(false);

  // 초기 17개 연락처 자동 Seeding 로직
  useEffect(() => {
    if (!loading && contacts.length === 0 && !seedingTriggered.current) {
      seedingTriggered.current = true;
      const now = new Date().toISOString();
      const seeded: Contact[] = SEED_CONTACTS.map((sc, i) => ({
        ...sc,
        id: `contact-seed-${i}-${generateId()}`,
        createdAt: now,
        updatedAt: now
      }));
      setContacts(seeded);
      
      // replaceAll을 통해 E2EE 암호화 업로드
      replaceAll('CONTACTS', seeded)
        .then(ok => {
          if (ok) {
            console.log('[Seed] 17개의 기본 실무 주소록 데이터 Seeding 성공!');
          }
        })
        .catch(err => {
          console.error('[Seed] Seeding 중 오류가 발생했습니다:', err);
        });
    }
  }, [loading, contacts, setContacts]);

  const addContact = useCallback((contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newContact: Contact = {
      ...contact,
      id: generateId(),
      createdAt: now,
      updatedAt: now
    };
    setContacts(prev => [newContact, ...prev]);
    syncAdd(newContact);
    return newContact;
  }, [setContacts, syncAdd]);

  const updateContact = useCallback((id: string, updates: Partial<Contact>) => {
    const updatedFields = { ...updates, updatedAt: new Date().toISOString() };
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...updatedFields } : c));
    syncUpdate(id, updatedFields);
  }, [setContacts, syncUpdate]);

  const deleteContact = useCallback((id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
    syncDelete(id);
  }, [setContacts, syncDelete]);

  return {
    contacts,
    loading,
    addContact,
    updateContact,
    deleteContact
  };
}
