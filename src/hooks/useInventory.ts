'use client';

import { useCallback } from 'react';
import { useGoogleSheet, useSheetCrud } from './useGoogleSheet';
import { InventoryItem, StockChange, generateId } from '@/types';

export function useInventory() {
  const [items, setItems] = useGoogleSheet<InventoryItem>('INVENTORY', 'hchps-inventory', []);
  const [stockChanges, setStockChanges] = useGoogleSheet<StockChange>('STOCK_CHANGES', 'hchps-stock-changes', []);
  const itemCrud = useSheetCrud<InventoryItem>('INVENTORY');
  const scCrud = useSheetCrud<StockChange>('STOCK_CHANGES');

  const addItem = useCallback((item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newItem: InventoryItem = { ...item, id: generateId(), createdAt: now, updatedAt: now };
    setItems(prev => [newItem, ...prev]);
    itemCrud.syncAdd(newItem);
    return newItem;
  }, [setItems, itemCrud]);

  const updateItem = useCallback((id: string, updates: Partial<InventoryItem>) => {
    const updatedFields = { ...updates, updatedAt: new Date().toISOString() };
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updatedFields } : i));
    itemCrud.syncUpdate(id, updatedFields);
  }, [setItems, itemCrud]);

  const deleteItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    setStockChanges(prev => prev.filter(sc => sc.itemId !== id));
    itemCrud.syncDelete(id);
  }, [setItems, setStockChanges, itemCrud]);

  const adjustStock = useCallback((itemId: string, change: number, reason: string) => {
    const sc: StockChange = { id: generateId(), itemId, change, reason, date: new Date().toISOString() };
    setStockChanges(prev => [sc, ...prev]);
    setItems(prev => {
      const updated = prev.map(i => i.id === itemId ? { ...i, currentStock: i.currentStock + change, updatedAt: new Date().toISOString() } : i);
      // Sync with KV using fresh state (avoids stale closure)
      const item = updated.find(i => i.id === itemId);
      if (item) {
        itemCrud.syncUpdate(itemId, { currentStock: item.currentStock, updatedAt: item.updatedAt });
      }
      return updated;
    });
    scCrud.syncAdd(sc);
    return sc;
  }, [setItems, setStockChanges, itemCrud, scCrud]);

  const getItemHistory = useCallback((itemId: string) => {
    return stockChanges.filter(sc => sc.itemId === itemId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [stockChanges]);

  return { items, stockChanges, addItem, updateItem, deleteItem, adjustStock, getItemHistory };
}
