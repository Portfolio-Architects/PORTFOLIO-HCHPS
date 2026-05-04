const fs = require('fs');
let txt = fs.readFileSync('src/components/budget/BudgetDashboard.tsx', 'utf8');

const strat = txt.indexOf('        {/* Card 3: Daily Expense Issuance */}');
const end = txt.indexOf('      {/* Categories */}');

const newContent = `        {/* Card 3: Daily Expense Issuance */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col h-full justify-between">
          <div className="text-[13px] font-bold text-amber-600 mb-2 tracking-wide flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> 일상경비 이체내역</div>
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="bg-gray-50 rounded p-2.5 border border-gray-100 flex justify-between items-center">
              <div className="text-[11px] text-gray-500 font-bold">교부액 (원금)</div>
              <div className="text-[13px] font-bold text-gray-700">{formatN(filteredStats.dailyExpenseIssued)}원</div>
            </div>
            <div className="bg-gray-50 rounded p-2.5 border border-gray-100 flex justify-between items-center">
              <div className="text-[11px] text-gray-500 font-bold">실지출액</div>
              <div className="text-[13px] font-bold text-gray-700">{formatN(filteredStats.dailyExpenseSpent)}원</div>
            </div>
            <div className="bg-amber-50 rounded p-2.5 border border-amber-200 flex justify-between items-center shadow-sm">
              <div className="text-[11px] text-amber-800 font-bold">가용 잔액</div>
              <div className="text-[14px] font-black text-amber-700">{formatN(filteredStats.dailyExpenseRemaining)}원</div>
            </div>
          </div>
        </div>

        {/* Card 4: Total Available Remaining */}
        <div className="bg-teal-700 rounded-xl border border-teal-800 p-5 flex flex-col h-full justify-between shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[14px] font-bold text-teal-50 tracking-wide flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-teal-300"></div> 총 가용 잔액
            </div>
            <button onClick={() => setShowLedgerModal(true)} className="flex items-center gap-1.5 text-[12px] bg-teal-800 hover:bg-teal-900 text-white px-3 py-1.5 rounded transition-colors font-bold border border-teal-600 shadow-sm">
              <Search size={14} /> 상세 대조
            </button>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-sm">{formatN(filteredStats.remaining)}<span className="text-xl font-semibold text-teal-100 ml-1">원</span></div>
            <div className="mt-3 text-[11px] text-teal-100 font-medium bg-teal-800/50 p-2 rounded border border-teal-600/50 border-dashed">원장대조 버튼으로 영수증 누락을 확인하세요.</div>
          </div>
        </div>
      </div>

`;

txt = txt.slice(0, strat) + newContent + txt.slice(end);
fs.writeFileSync('src/components/budget/BudgetDashboard.tsx', txt);
