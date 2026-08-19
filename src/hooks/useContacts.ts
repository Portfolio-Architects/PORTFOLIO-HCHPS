'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { readSheet, addRow, updateRow, deleteRow, replaceAll } from '@/lib/sheets-api';
import { Contact, generateId } from '@/types';

export function useContacts() {
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading: loading } = useQuery({
    queryKey: ['CONTACTS'],
    queryFn: () => readSheet<Contact>('CONTACTS'),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchIntervalInBackground: false,
    initialData: () => {
      if (typeof window !== 'undefined') {
        try {
          const item = localStorage.getItem('hchps-fallback-CONTACTS') || localStorage.getItem('hchps-contacts');
          if (item) {
            const parsed = JSON.parse(item);
            if (Array.isArray(parsed)) return parsed as Contact[];
          }
        } catch (err) {
          console.warn('[useContacts] Initial data parse error:', err);
        }
      }
      return undefined;
    },
  });

  const replaceContactsMut = useMutation({
    mutationFn: (newContacts: Contact[]) => replaceAll('CONTACTS', newContacts),
    onMutate: async (newContacts) => {
      await queryClient.cancelQueries({ queryKey: ['CONTACTS'] });
      const previous = queryClient.getQueryData<Contact[]>(['CONTACTS']);
      queryClient.setQueryData<Contact[]>(['CONTACTS'], newContacts);
      return { previous };
    },
    onError: (err, newContacts, context) => {
      if (context?.previous) queryClient.setQueryData(['CONTACTS'], context.previous);
    },
  });

  const addContactMut = useMutation({
    mutationFn: (newContact: Contact) => addRow('CONTACTS', newContact),
    onMutate: async (newContact) => {
      await queryClient.cancelQueries({ queryKey: ['CONTACTS'] });
      const previous = queryClient.getQueryData<Contact[]>(['CONTACTS']);
      queryClient.setQueryData<Contact[]>(['CONTACTS'], (old) => [newContact, ...(old || [])]);
      return { previous };
    },
    onError: (err, newContact, context) => {
      if (context?.previous) queryClient.setQueryData(['CONTACTS'], context.previous);
    },
  });

  const updateContactMut = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Contact> }) => updateRow('CONTACTS', id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['CONTACTS'] });
      const previous = queryClient.getQueryData<Contact[]>(['CONTACTS']);
      const updatedFields = { ...updates, updatedAt: new Date().toISOString() };
      queryClient.setQueryData<Contact[]>(['CONTACTS'], (old) =>
        (old || []).map(c => c.id === id ? { ...c, ...updatedFields } : c)
      );
      return { previous };
    },
    onError: (err, vars, context) => {
      if (context?.previous) queryClient.setQueryData(['CONTACTS'], context.previous);
    },
  });

  const deleteContactMut = useMutation({
    mutationFn: (id: string) => deleteRow('CONTACTS', id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['CONTACTS'] });
      const previous = queryClient.getQueryData<Contact[]>(['CONTACTS']);
      queryClient.setQueryData<Contact[]>(['CONTACTS'], (old) => (old || []).filter(c => c.id !== id));
      return { previous };
    },
    onError: (err, id, context) => {
      if (context?.previous) queryClient.setQueryData(['CONTACTS'], context.previous);
    },
  });

  const addContact = useCallback((contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newContact: Contact = {
      ...contact,
      id: generateId(),
      createdAt: now,
      updatedAt: now
    };
    addContactMut.mutate(newContact);
    return newContact;
  }, [addContactMut]);

  const updateContact = useCallback((id: string, updates: Partial<Contact>) => {
    updateContactMut.mutate({ id, updates });
  }, [updateContactMut]);

  const deleteContact = useCallback((id: string) => {
    deleteContactMut.mutate(id);
  }, [deleteContactMut]);

  const replaceContacts = useCallback((newContacts: Contact[]) => {
    replaceContactsMut.mutate(newContacts);
  }, [replaceContactsMut]);

  return {
    contacts,
    loading,
    addContact,
    updateContact,
    deleteContact,
    replaceContacts
  };
}
