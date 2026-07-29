'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { readSheet, addRow, updateRow, deleteRow } from '@/lib/sheets-api';
import { InventoryItem, StockChange, generateId } from '@/types';

export function useInventory() {
  const queryClient = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ['INVENTORY'],
    queryFn: () => readSheet<InventoryItem>('INVENTORY'),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchIntervalInBackground: false,
    initialData: () => {
      if (typeof window !== 'undefined') {
        try {
          const item = localStorage.getItem('hchps-fallback-INVENTORY') || localStorage.getItem('hchps-inventory');
          if (item) {
            const parsed = JSON.parse(item);
            if (Array.isArray(parsed)) return parsed as InventoryItem[];
          }
        } catch (err) {
          console.warn('[useInventory] Initial items parse error:', err);
        }
      }
      return undefined;
    },
  });

  const { data: stockChanges = [] } = useQuery({
    queryKey: ['STOCK_CHANGES'],
    queryFn: () => readSheet<StockChange>('STOCK_CHANGES'),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchIntervalInBackground: false,
    initialData: () => {
      if (typeof window !== 'undefined') {
        try {
          const item = localStorage.getItem('hchps-fallback-STOCK_CHANGES') || localStorage.getItem('hchps-stock-changes');
          if (item) {
            const parsed = JSON.parse(item);
            if (Array.isArray(parsed)) return parsed as StockChange[];
          }
        } catch (err) {
          console.warn('[useInventory] Initial stockChanges parse error:', err);
        }
      }
      return undefined;
    },
  });

  const addItemMut = useMutation({
    mutationFn: (newItem: InventoryItem) => addRow('INVENTORY', newItem),
    onMutate: async (newItem) => {
      await queryClient.cancelQueries({ queryKey: ['INVENTORY'] });
      const previous = queryClient.getQueryData<InventoryItem[]>(['INVENTORY']);
      queryClient.setQueryData<InventoryItem[]>(['INVENTORY'], (old) => [newItem, ...(old || [])]);
      return { previous };
    },
    onError: (err, newItem, context) => {
      if (context?.previous) queryClient.setQueryData(['INVENTORY'], context.previous);
    },
  });

  const updateItemMut = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<InventoryItem> }) => updateRow('INVENTORY', id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['INVENTORY'] });
      const previous = queryClient.getQueryData<InventoryItem[]>(['INVENTORY']);
      const updatedFields = { ...updates, updatedAt: new Date().toISOString() };
      queryClient.setQueryData<InventoryItem[]>(['INVENTORY'], (old) =>
        (old || []).map(i => i.id === id ? { ...i, ...updatedFields } : i)
      );
      return { previous };
    },
    onError: (err, vars, context) => {
      if (context?.previous) queryClient.setQueryData(['INVENTORY'], context.previous);
    },
  });

  const deleteItemMut = useMutation({
    mutationFn: (id: string) => deleteRow('INVENTORY', id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['INVENTORY'] });
      const previous = queryClient.getQueryData<InventoryItem[]>(['INVENTORY']);
      queryClient.setQueryData<InventoryItem[]>(['INVENTORY'], (old) => (old || []).filter(i => i.id !== id));
      return { previous };
    },
    onError: (err, id, context) => {
      if (context?.previous) queryClient.setQueryData(['INVENTORY'], context.previous);
    },
  });

  const addStockChangeMut = useMutation({
    mutationFn: (sc: StockChange) => addRow('STOCK_CHANGES', sc),
    onMutate: async (sc) => {
      await queryClient.cancelQueries({ queryKey: ['STOCK_CHANGES'] });
      const previous = queryClient.getQueryData<StockChange[]>(['STOCK_CHANGES']);
      queryClient.setQueryData<StockChange[]>(['STOCK_CHANGES'], (old) => [sc, ...(old || [])]);
      return { previous };
    },
    onError: (err, sc, context) => {
      if (context?.previous) queryClient.setQueryData(['STOCK_CHANGES'], context.previous);
    },
  });

  const deleteStockChangesByItemMut = useMutation({
    mutationFn: async (itemId: string) => {
      const changes = queryClient.getQueryData<StockChange[]>(['STOCK_CHANGES']) || [];
      const itemChanges = changes.filter(sc => sc.itemId === itemId);
      for (const sc of itemChanges) {
        await deleteRow('STOCK_CHANGES', sc.id);
      }
    },
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: ['STOCK_CHANGES'] });
      const previous = queryClient.getQueryData<StockChange[]>(['STOCK_CHANGES']);
      queryClient.setQueryData<StockChange[]>(['STOCK_CHANGES'], (old) => (old || []).filter(sc => sc.itemId !== itemId));
      return { previous };
    },
    onError: (err, itemId, context) => {
      if (context?.previous) queryClient.setQueryData(['STOCK_CHANGES'], context.previous);
    },
  });

  const addItem = useCallback((item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newItem: InventoryItem = { ...item, id: generateId(), createdAt: now, updatedAt: now };
    addItemMut.mutate(newItem);
    return newItem;
  }, [addItemMut]);

  const updateItem = useCallback((id: string, updates: Partial<InventoryItem>) => {
    updateItemMut.mutate({ id, updates });
  }, [updateItemMut]);

  const deleteItem = useCallback((id: string) => {
    deleteItemMut.mutate(id);
    deleteStockChangesByItemMut.mutate(id);
  }, [deleteItemMut, deleteStockChangesByItemMut]);

  const adjustStock = useCallback((itemId: string, change: number, reason: string) => {
    const sc: StockChange = { id: generateId(), itemId, change, reason, date: new Date().toISOString() };
    const currentItem = items.find(i => i.id === itemId);
    if (currentItem) {
      const newStock = currentItem.currentStock + change;
      updateItemMut.mutate({ id: itemId, updates: { currentStock: newStock } });
    }
    addStockChangeMut.mutate(sc);
    return sc;
  }, [items, updateItemMut, addStockChangeMut]);

  const getItemHistory = useCallback((itemId: string) => {
    return stockChanges.filter(sc => sc.itemId === itemId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [stockChanges]);

  return { items, stockChanges, addItem, updateItem, deleteItem, adjustStock, getItemHistory };
}
