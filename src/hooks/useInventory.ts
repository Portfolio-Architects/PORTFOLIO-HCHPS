'use client';

import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { InventoryItem, StockChange, generateId } from '@/types';

export function useInventory() {
  const [items, setItems] = useLocalStorage<InventoryItem[]>('hchps-inventory', []);
  const [stockChanges, setStockChanges] = useLocalStorage<StockChange[]>('hchps-stock-changes', []);

  const addItem = useCallback((item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newItem: InventoryItem = { ...item, id: generateId(), createdAt: now, updatedAt: now };
    setItems(prev => [newItem, ...prev]);
    return newItem;
  }, [setItems]);

  const updateItem = useCallback((id: string, updates: Partial<InventoryItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i));
  }, [setItems]);

  const deleteItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    setStockChanges(prev => prev.filter(sc => sc.itemId !== id));
  }, [setItems, setStockChanges]);

  const adjustStock = useCallback((itemId: string, change: number, reason: string) => {
    const sc: StockChange = { id: generateId(), itemId, change, reason, date: new Date().toISOString() };
    setStockChanges(prev => [sc, ...prev]);
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, currentStock: i.currentStock + change, updatedAt: new Date().toISOString() } : i));
    return sc;
  }, [setItems, setStockChanges]);

  const getItemHistory = useCallback((itemId: string) => {
    return stockChanges.filter(sc => sc.itemId === itemId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [stockChanges]);

  return { items, stockChanges, addItem, updateItem, deleteItem, adjustStock, getItemHistory };
}
