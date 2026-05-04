const fs = require('fs');
let txt = fs.readFileSync('src/components/budget/BudgetDashboard.tsx', 'utf8');

const oldCard3 = `<div className="text-[15px] font-bold text-gray-700">{formatN(filteredStats.dailyExpenseSpent)}<span className="text-[10px] text-gray-400 ml-1">원</span></div>
            </div>
          </div>
        </div>`;

const newCard3 = `<div className="text-[15px] font-bold text-gray-700">{formatN(filteredStats.dailyExpenseSpent)}<span className="text-[10px] text-gray-400 ml-1">원</span></div>
            </div>
            <div className="bg-amber-50 rounded p-3 border border-amber-100 flex justify-between items-end mt-1">
              <div className="text-[11px] text-amber-800 font-bold mb-0.5">가용 잔액</div>
              <div className="text-[15px] font-black text-amber-700">{formatN(filteredStats.dailyExpenseRemaining)}<span className="text-[10px] text-amber-500 ml-1">원</span></div>
            </div>
          </div>
        </div>`;
txt = txt.replace(oldCard3, newCard3);

const oldCard4Name = `<div className="w-1.5 h-1.5 rounded-full bg-teal-300"></div> 가용 잔액`;
const newCard4Name = `<div className="w-1.5 h-1.5 rounded-full bg-teal-300"></div> 총 가용 잔액`;
txt = txt.replace(oldCard4Name, newCard4Name);

const oldCard4Amt = `<div className="text-3xl font-black text-white tracking-tight">{formatN(filteredStats.dailyExpenseRemaining)}<span className="text-base font-semibold text-teal-100 ml-1">원</span></div>`;
const newCard4Amt = `<div className="text-4xl font-black text-white tracking-tight">{formatN(filteredStats.remaining)}<span className="text-xl font-semibold text-teal-100 ml-1">원</span></div>`;
txt = txt.replace(oldCard4Amt, newCard4Amt);

fs.writeFileSync('src/components/budget/BudgetDashboard.tsx', txt);
console.log('Done!');
