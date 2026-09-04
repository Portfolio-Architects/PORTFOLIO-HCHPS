import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useYangjaeFestival, useSaveYangjaeFestival, YANGJAE_FALLBACK_DATA, FestivalData, calculateFestivalBudgetSummary } from '@/hooks/useYangjaeFestival';
import { YangjaeFestivalDashboard, STAFF_PHONE_MAP, getStaffInfo } from '@/components/festival/YangjaeFestivalDashboard';
import { renderHook } from '@testing-library/react';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const testQueryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={testQueryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('Yangjae Festival Real-time Multi-Device Sync & UX Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => YANGJAE_FALLBACK_DATA,
    });
    // Set secure context for clipboard API in test environment
    Object.defineProperty(window, 'isSecureContext', { value: true, writable: true, configurable: true });
  });

  describe('R1. Zero-Refresh Smart Polling & Visibility Pause Configuration', () => {
    it('configures useYangjaeFestival with 2500ms polling, 1000ms staleTime, and background pause', () => {
      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useYangjaeFestival(), { wrapper });

      const query = queryClient.getQueryCache().find({ queryKey: ['festival', 'yangjae'] });
      expect(query).toBeDefined();

      const options = (query?.options as Record<string, any>) || {};
      // R1: refetchInterval = 2500, staleTime = 1000
      expect(options?.refetchInterval).toBe(2500);
      expect(options?.staleTime).toBe(1000);
      // Rule J: Pause background polling when tab is hidden
      expect(options?.refetchIntervalInBackground).toBe(false);
      // Immediate refetch when returning to tab
      expect(options?.refetchOnWindowFocus).toBe(true);

      // Data is correctly initialized
      expect(result.current.data?.meta?.title).toBe(YANGJAE_FALLBACK_DATA.meta.title);
    });
  });

  describe('R2. Default Collapsed State for Milestone Tasks', () => {
    it('starts with all 6 milestone tasks collapsed by default and provides full accordion toggle', async () => {
      renderWithClient(<YangjaeFestivalDashboard />);

      // Verify "전체 펼치기" button is initially displayed
      const toggleAllBtn = await screen.findByRole('button', { name: /전체 펼치기/i });
      expect(toggleAllBtn).toBeInTheDocument();

      // In collapsed state, task details should not be rendered
      expect(screen.queryByText(/수변문화쉼터.*검토/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/09:00~09:30/i)).not.toBeInTheDocument();

      // Click "전체 펼치기" -> all 6 tasks expand
      fireEvent.click(toggleAllBtn);

      // Now "전체 접기" button should be shown
      expect(screen.getByRole('button', { name: /전체 접기/i })).toBeInTheDocument();

      // Details for Task 1 should now be visible
      expect(screen.getByText(/수변문화쉼터.*검토/i)).toBeInTheDocument();

      // Click "전체 접기" -> all tasks collapse again
      const collapseAllBtn = screen.getByRole('button', { name: /전체 접기/i });
      fireEvent.click(collapseAllBtn);

      // Verify button reverted to "전체 펼치기" and details are hidden again
      expect(screen.getByRole('button', { name: /전체 펼치기/i })).toBeInTheDocument();
      expect(screen.queryByText(/수변문화쉼터.*검토/i)).not.toBeInTheDocument();

      // Click individual task title (e.g., "추진과제 1") -> expands only Task 1
      const task1Btn = screen.getByRole('button', { name: /추진과제 1/i });
      expect(task1Btn).toBeInTheDocument();
      fireEvent.click(task1Btn);

      // Task 1 details should now be visible
      expect(await screen.findByText(/수변문화쉼터.*검토/i)).toBeInTheDocument();
      // But Task 2 details should still remain collapsed
      expect(screen.queryByText(/09:00~09:30/i)).not.toBeInTheDocument();
    });

    it('handles multiple individual task toggles independently and preserves O(1) state', async () => {
      renderWithClient(<YangjaeFestivalDashboard />);

      const task1Btn = await screen.findByRole('button', { name: /추진과제 1/i });
      const task2Btn = screen.getByRole('button', { name: /추진과제 2/i });

      // Expand Task 1
      fireEvent.click(task1Btn);
      expect(screen.getByText(/수변문화쉼터.*검토/i)).toBeInTheDocument();
      expect(screen.queryByText(/09:00~09:30/i)).not.toBeInTheDocument();

      // Expand Task 2
      fireEvent.click(task2Btn);
      expect(screen.getByText(/수변문화쉼터.*검토/i)).toBeInTheDocument();
      expect(screen.getByText(/09:00~09:30/i)).toBeInTheDocument();

      // Collapse Task 1 only
      fireEvent.click(task1Btn);
      expect(screen.queryByText(/수변문화쉼터.*검토/i)).not.toBeInTheDocument();
      expect(screen.getByText(/09:00~09:30/i)).toBeInTheDocument();
    });
  });

  describe('R3. Real-time Auto-Sync Badge & Mobile Sharing Pipeline', () => {
    it('renders clean single-line title without unrequested sync badges or department subtitles', async () => {
      renderWithClient(<YangjaeFestivalDashboard />);

      // Main title should be cleanly rendered
      expect(await screen.findByText('2026 양재천 건강 페스티벌')).toBeInTheDocument();
      // Unrequested badges or subtitles should not be present in the header
      expect(screen.queryByText('실시간 자동 동기화 중')).not.toBeInTheDocument();
      expect(screen.queryByText('강남구보건소 보건행정과')).not.toBeInTheDocument();
    });

    it('renders share button and copies formatted weekly progress report with Cloudflare URL', async () => {
      // Mock clipboard
      const writeTextMock = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      renderWithClient(<YangjaeFestivalDashboard />);

      // Share button should be visible to all devices
      const shareBtn = await screen.findByRole('button', { name: /공유/i });
      expect(shareBtn).toBeInTheDocument();

      // Click share
      fireEvent.click(shareBtn);

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalledTimes(1);
      });

      const copiedText = writeTextMock.mock.calls[0][0];
      // Must contain festival title, period, weekly report items, and active Cloudflare URL
      expect(copiedText).toContain('2026 양재천 건강 페스티벌');
      expect(copiedText).toContain('주간 추진실적 보고');
      expect(copiedText).toContain('8. 31. ~ 9. 4.');
      expect(copiedText).toContain('https://codes-investing-findings-lucas.trycloudflare.com/festival/yangjae');
      expect(copiedText).toContain('1. [홍보] 행사 포스터 제작 진행중');
    });

    it('falls back cleanly if weeklyReport is absent in custom payload', async () => {
      const customDataWithoutWeekly: FestivalData = {
        ...YANGJAE_FALLBACK_DATA,
        weeklyReport: undefined,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => customDataWithoutWeekly,
      });

      const writeTextMock = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      renderWithClient(<YangjaeFestivalDashboard />);

      const shareBtn = await screen.findByRole('button', { name: /공유/i });
      fireEvent.click(shareBtn);

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalledTimes(1);
      });

      const copiedText = writeTextMock.mock.calls[0][0];
      expect(copiedText).toContain('https://codes-investing-findings-lucas.trycloudflare.com/festival/yangjae');
      expect(copiedText).toContain('8. 31. ~ 9. 4.');
    });

    it('falls back to document.execCommand in insecure HTTP or webview contexts without throwing', async () => {
      // Insecure context where navigator.clipboard is undefined
      Object.defineProperty(window, 'isSecureContext', { value: false, writable: true, configurable: true });
      const origClipboard = navigator.clipboard;
      Object.defineProperty(navigator, 'clipboard', { value: undefined, writable: true, configurable: true });

      const execCommandMock = jest.fn().mockReturnValue(true);
      document.execCommand = execCommandMock;

      renderWithClient(<YangjaeFestivalDashboard />);

      const shareBtn = await screen.findByRole('button', { name: /공유/i });
      fireEvent.click(shareBtn);

      await waitFor(() => {
        expect(execCommandMock).toHaveBeenCalledWith('copy');
      });

      // Verify no leaked textarea in DOM
      expect(document.querySelector('textarea[style*="-999999px"]')).toBeNull();

      // Restore clipboard
      Object.defineProperty(navigator, 'clipboard', { value: origClipboard, writable: true, configurable: true });
      Object.defineProperty(window, 'isSecureContext', { value: true, writable: true, configurable: true });
    });

      it('handles clipboard failure gracefully and falls back to window.prompt when Web Share is absent', async () => {
      Object.defineProperty(window, 'isSecureContext', { value: true, writable: true, configurable: true });
      const writeTextMock = jest.fn().mockRejectedValue(new Error('Permission Denied in Sandbox'));
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
        share: undefined,
      });

      document.execCommand = jest.fn().mockImplementation(() => {
        throw new Error('execCommand disabled');
      });

      const promptMock = jest.fn();
      window.prompt = promptMock;

      renderWithClient(<YangjaeFestivalDashboard />);

      const shareBtn = await screen.findByRole('button', { name: /공유/i });
      fireEvent.click(shareBtn);

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalled();
        expect(promptMock).toHaveBeenCalledWith(
          expect.stringContaining('아래 주간 추진실적 내용을 복사'),
          expect.stringContaining('2026 양재천 건강 페스티벌')
        );
      });

      // Cleaned up DOM even when execCommand threw
      expect(document.querySelector('textarea[style*="-999999px"]')).toBeNull();
    });

    it('invokes native navigator.share when available and avoids duplicate URL strings', async () => {
      const shareMock = jest.fn().mockResolvedValue(undefined);
      const writeTextMock = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
        share: shareMock,
        canShare: jest.fn().mockReturnValue(true),
      });

      renderWithClient(<YangjaeFestivalDashboard />);

      const shareBtn = await screen.findByRole('button', { name: /공유/i });
      fireEvent.click(shareBtn);

      await waitFor(() => {
        expect(shareMock).toHaveBeenCalledTimes(1);
      });

      const sharePayload = shareMock.mock.calls[0][0];
      expect(sharePayload.title).toContain('2026 양재천 건강 페스티벌 주간 실적보고');
      // text already contains the target URL; url field should not be redundantly passed to avoid duplication
      expect(sharePayload.text).toContain('https://codes-investing-findings-lucas.trycloudflare.com/festival/yangjae');
      expect(sharePayload.url).toBeUndefined();
    });
  });

  describe('Edge Cases & Defense Verification', () => {
    it('handles empty milestones list without crashing or falsely displaying "전체 접기"', async () => {
      const customDataEmptyMilestones: FestivalData = {
        ...YANGJAE_FALLBACK_DATA,
        milestones: [],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => customDataEmptyMilestones,
      });

      renderWithClient(<YangjaeFestivalDashboard />);

      // Top toggle should display "전체 펼치기" (not "전체 접기") when 0 milestones exist
      const toggleBtn = await screen.findByRole('button', { name: /전체 펼치기/i });
      expect(toggleBtn).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /전체 접기/i })).not.toBeInTheDocument();

      // Clicking it does not throw
      fireEvent.click(toggleBtn);
      expect(toggleBtn).toBeInTheDocument();
    });

    it('throttles rapid focus triggers within staleTime (1000ms)', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      renderHook(() => useYangjaeFestival(), { wrapper });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      // Rapidly simulate window focus within 100ms
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('focus'));

      // Due to staleTime: 1000, no second network call should be triggered immediately
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('cancels in-flight queries and extracts nested data in useSaveYangjaeFestival mutation', async () => {
      const queryClient = createTestQueryClient();
      const cancelSpy = jest.spyOn(queryClient, 'cancelQueries');
      const setQueryDataSpy = jest.spyOn(queryClient, 'setQueryData');
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      // Backend API wraps response in { success: true, message: '...', data: payload }
      const updatedPayload: FestivalData = {
        ...YANGJAE_FALLBACK_DATA,
        meta: {
          ...YANGJAE_FALLBACK_DATA.meta,
          title: '2026 양재천 페스티벌 변경 타이틀',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Saved successfully',
          data: updatedPayload,
        }),
      });

      const { result } = renderHook(() => useSaveYangjaeFestival(), { wrapper });

      await result.current.mutateAsync(updatedPayload);

      // onMutate must cancel any in-flight queries to prevent polling race conditions
      expect(cancelSpy).toHaveBeenCalledWith({ queryKey: ['festival', 'yangjae'] });

      // onSuccess must extract nested data and set FestivalData (not the response wrapper)
      expect(setQueryDataSpy).toHaveBeenCalledWith(['festival', 'yangjae'], updatedPayload);
      const cachedData = queryClient.getQueryData<FestivalData>(['festival', 'yangjae']);
      expect(cachedData?.meta?.title).toBe('2026 양재천 페스티벌 변경 타이틀');

      // Invalidates query for subsequent refetch
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['festival', 'yangjae'] });
    });
  });

  describe('R4. Task Detail Rows Reordering Controls (▲/▼)', () => {
    it('renders move up and move down buttons in edit mode with boundary disablement and swaps order', async () => {
      renderWithClient(<YangjaeFestivalDashboard />);

      // Wait for dashboard to load
      await waitFor(() => {
        expect(screen.getByText('2026 양재천 건강 페스티벌')).toBeInTheDocument();
      });

      // Find first "과제 수정" button
      const editButtons = screen.getAllByTitle('과제 수정');
      expect(editButtons.length).toBeGreaterThan(0);
      fireEvent.click(editButtons[0]);

      // Edit mode opens: hint text appears
      await waitFor(() => {
        expect(screen.getByText('▲▼ 버튼으로 순서 이동 가능')).toBeInTheDocument();
      });

      // Get all move up and move down buttons
      const moveUpButtons = screen.getAllByTitle('위로 이동');
      const moveDownButtons = screen.getAllByTitle('아래로 이동');
      expect(moveUpButtons.length).toBeGreaterThan(1);
      expect(moveDownButtons.length).toBeGreaterThan(1);

      // Boundary checks:
      // First row: canMoveUp should be false (disabled)
      expect(moveUpButtons[0]).toBeDisabled();
      // First row: canMoveDown should be true (enabled)
      expect(moveDownButtons[0]).not.toBeDisabled();

      // Last row: canMoveDown should be false (disabled)
      const lastIdx = moveDownButtons.length - 1;
      expect(moveDownButtons[lastIdx]).toBeDisabled();
      // Last row: canMoveUp should be true (enabled)
      expect(moveUpButtons[lastIdx]).not.toBeDisabled();

      // Get dates of first and second rows before move
      const dateInputsBefore = screen.getAllByPlaceholderText('날짜 (7.29)') as HTMLInputElement[];
      const firstDateBefore = dateInputsBefore[0].value;
      const secondDateBefore = dateInputsBefore[1].value;

      // Click move down on the first item
      fireEvent.click(moveDownButtons[0]);

      // Verify that positions have swapped
      const dateInputsAfter = screen.getAllByPlaceholderText('날짜 (7.29)') as HTMLInputElement[];
      expect(dateInputsAfter[0].value).toBe(secondDateBefore);
      expect(dateInputsAfter[1].value).toBe(firstDateBefore);

      // Click move up on the new first item's sibling (index 1) to swap back
      const updatedMoveUpButtons = screen.getAllByTitle('위로 이동');
      fireEvent.click(updatedMoveUpButtons[1]);

      const dateInputsRestored = screen.getAllByPlaceholderText('날짜 (7.29)') as HTMLInputElement[];
      expect(dateInputsRestored[0].value).toBe(firstDateBefore);
      expect(dateInputsRestored[1].value).toBe(secondDateBefore);
    });

    it('preserves input identity and focus stability without unmounting when typing in detail fields', async () => {
      renderWithClient(<YangjaeFestivalDashboard />);

      await waitFor(() => {
        expect(screen.getByText('2026 양재천 건강 페스티벌')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('과제 수정');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('▲▼ 버튼으로 순서 이동 가능')).toBeInTheDocument();
      });

      const dateInputs = screen.getAllByPlaceholderText('날짜 (7.29)') as HTMLInputElement[];
      const targetInput = dateInputs[0];
      targetInput.focus();
      expect(document.activeElement).toBe(targetInput);

      // Type into date input
      fireEvent.change(targetInput, { target: { value: '8.15' } });
      expect(targetInput.value).toBe('8.15');

      // The input element must remain mounted and focused
      expect(document.activeElement).toBe(targetInput);

      // Now type into textarea of first row
      const textareas = screen.getAllByPlaceholderText(/세부 과업 내용 입력/) as HTMLTextAreaElement[];
      const targetTextarea = textareas[0];
      targetTextarea.focus();
      expect(document.activeElement).toBe(targetTextarea);

      fireEvent.change(targetTextarea, { target: { value: '새로운 세부 과업 내용 입력 테스트' } });
      expect(targetTextarea.value).toBe('새로운 세부 과업 내용 입력 테스트');
      expect(document.activeElement).toBe(targetTextarea);
    });
  });

  describe('R5. Budget Calculations & Zero-Refresh Live Updates Robustness', () => {
    it('calculates festival budget metrics safely with NaN guards for malformed or undefined numbers', () => {
      // 1. undefined budget
      const resUndefined = calculateFestivalBudgetSummary(undefined);
      expect(resUndefined).toEqual({
        total: 0,
        allocatedTotal: 0,
        balance: 0,
        executionRate: 0,
      });

      // 2. Normal budget
      const resNormal = calculateFestivalBudgetSummary({
        total: 49900000,
        allocated: {
          agencyService: 36950000,
          suppliesAndRental: 9300000,
          refreshments: 2450000,
          volunteerSupport: 1200000,
        },
        agencyQuotation: 50215000,
        agencyCompany: '제이민 커뮤니케이션',
      });
      expect(resNormal.total).toBe(49900000);
      expect(resNormal.allocatedTotal).toBe(49900000);
      expect(resNormal.balance).toBe(0);
      expect(resNormal.executionRate).toBe(100);

      // 3. Malformed strings / NaN / partial values
      const resMalformed = calculateFestivalBudgetSummary({
        total: NaN,
        allocated: {
          agencyService: '30000000' as any,
          suppliesAndRental: undefined as any,
          refreshments: null as any,
          volunteerSupport: 'not-a-number' as any,
        },
        agencyQuotation: NaN,
        agencyCompany: '',
      });
      expect(resMalformed.total).toBe(0);
      expect(resMalformed.allocatedTotal).toBe(30000000);
      expect(resMalformed.balance).toBe(-30000000);
      expect(resMalformed.executionRate).toBe(0);
      expect(Number.isNaN(resMalformed.executionRate)).toBe(false);
    });

    it('does not display unrequested budget row in Section 1 overview card and displays staff substitute holiday note', async () => {
      renderWithClient(<YangjaeFestivalDashboard />);

      // Section 1 overview should render meta items without unrequested budget row
      expect(await screen.findByText('2026 양재천 건강 페스티벌')).toBeInTheDocument();
      expect(screen.getByText(/양재천 수변문화쉼터/)).toBeInTheDocument();
      // Unrequested budget row must NOT be rendered in Section 1
      expect(screen.queryByText(/4,990만원/)).not.toBeInTheDocument();
      expect(screen.queryByText(/배정완료/)).not.toBeInTheDocument();
      expect(screen.queryByText(/대행용역 3,695만/)).not.toBeInTheDocument();

      // Staff compensatory leave note should be rendered at the bottom of overview
      expect(screen.getByText('행사 참여 직원 대체휴무 시행 예정')).toBeInTheDocument();
    });
  });

  describe('R6. Mobile Ultra-Narrow 320px Responsive Layout & Truncation Guard', () => {
    it('applies responsive padding and whitespace-nowrap to prevent button wrapping on 320px screens', async () => {
      renderWithClient(<YangjaeFestivalDashboard />);

      const titleEl = await screen.findByText('2026 양재천 건강 페스티벌');
      expect(titleEl).toBeInTheDocument();
      expect(titleEl).toHaveClass('truncate');

      // Top sticky header should have responsive padding for 320px
      const headerContainer = titleEl.closest('.sticky');
      expect(headerContainer).toHaveClass('px-3');
      expect(headerContainer).toHaveClass('sm:px-4');

      // Action buttons should have whitespace-nowrap
      const shareBtn = screen.getByRole('button', { name: /공유/i });
      expect(shareBtn).toHaveClass('whitespace-nowrap');
    });
  });

  describe('R7. Staff Extension Number Direct Phone Mapping', () => {
    it('maps Lim Seok-hwon (7012) and Nam Sang-hee (7025) official extensions accurately', () => {
      expect(STAFF_PHONE_MAP['임석훤']).toEqual({ ext: '7012', full: '02-3423-7012', role: '주무관' });
      expect(STAFF_PHONE_MAP['남상희']).toEqual({ ext: '7025', full: '02-3423-7025', role: '주무관' });
      expect(STAFF_PHONE_MAP['서승오']).toEqual({ ext: '7034', full: '02-3423-7034', role: '주무관' });

      const infoLim = getStaffInfo('임석훤 주무관');
      expect(infoLim).not.toBeNull();
      expect(infoLim?.ext).toBe('7012');
      expect(infoLim?.full).toBe('02-3423-7012');

      const infoNam = getStaffInfo('남상희 주무관');
      expect(infoNam).not.toBeNull();
      expect(infoNam?.ext).toBe('7025');
      expect(infoNam?.full).toBe('02-3423-7025');
    });
  });
});


