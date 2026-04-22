const fs = require('fs');
let file = 'src/components/budget/BudgetDashboard.tsx';
let txt = fs.readFileSync(file, 'utf8');

const anchor1 = '<option value="시비">시비</option>';
const anchor2 = '<div className="flex bg-gray-100 p-1 rounded-lg mb-4">';

const idx1 = txt.indexOf(anchor1);
const idx2 = txt.indexOf(anchor2, idx1);

if (idx1 > -1 && idx2 > -1) {
    let before = txt.substring(0, idx1);
    let after = txt.substring(idx2);

    let replacement = `<option value="시비">시비</option>
                    <option value="구비">구비</option>
                    <option value="특교">특교</option>
                  </select>
                  <div className="relative" style={{ flex: 2 }}>
                    <input 
                      type="number" 
                      step="0.01"
                      value={split.ratio}
                      onChange={(e) => {
                         const newSplits = [...batchFundingSplits];
                         newSplits[i].ratio = e.target.value;
                         setBatchFundingSplits(newSplits);
                      }}
                      className={\`\${inputClass} pr-10 text-right font-bold\`}
                      placeholder="(기존 비율 유지)" 
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[15px] font-black text-blue-500">%</span>
                  </div>
                  {i === batchFundingSplits.length - 1 ? (
                     <button type="button" onClick={() => setBatchFundingSplits([...batchFundingSplits, {source: '시비', ratio: ''}])} className="text-blue-500 p-1 hover:bg-blue-50 rounded"><Plus size={16}/></button>
                  ) : (
                     <button type="button" onClick={() => setBatchFundingSplits(batchFundingSplits.filter((_, idx) => idx !== i))} className="text-red-400 p-1 hover:bg-red-50 rounded"><X size={16}/></button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-2">
            <button type="button" onClick={() => setShowBatchModal(false)} className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm">취소</button>
            <button type="submit" className="px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-lg hover:bg-opacity-90 transition-colors font-bold shadow-md shadow-blue-500/20 cursor-pointer text-sm">일괄 적용</button>
          </div>
        </form>
      </Modal>

      {/* Entry Modal */}
      <Modal isOpen={showEntryModal} onClose={() => setShowEntryModal(false)} title="지출 등록" size="sm" footer={(() => {
              const os = filteredStats;
              return (
                <div className="grid grid-cols-2 gap-3 w-full border-t pt-4 mt-2">
                  <div className="bg-gray-50 p-2 rounded text-center">
                    <div className="text-[10px] text-gray-500">가배정(품의)</div>
                    <div className="text-sm font-bold text-amber-600">{formatN(os.totalPlanned)}</div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded text-center">
                    <div className="text-[10px] text-gray-500">실가용 잔액</div>
                    <div className="text-sm font-bold text-emerald-600">{formatN(os.remaining - os.totalPlanned)}</div>
                  </div>
                </div>
              );
            })()}>
        `;

    fs.writeFileSync(file, before + replacement + after);
    console.log("Fixed BudgetDashboard.tsx");
} else {
    console.log("Could not find anchors: ", idx1, idx2);
}
