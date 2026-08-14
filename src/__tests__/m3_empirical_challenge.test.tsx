import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DetectiveValidationHUD } from '@/components/mindmap/ui/DetectiveValidationHUD';
import { FestivalValidationReport, EssentialPermitStatus, BudgetValidationReport } from '@/hooks/useFestivalValidation';
import { FESTIVAL_5DOMAINS } from '@/lib/presets/festival5DomainPreset';

describe('EMPIRICAL CHALLENGE SUITE: Milestone M3 Detective Validation HUD & Risk Engine', () => {

  // Helper factory for mock report
  const createMockReport = (overrides?: Partial<FestivalValidationReport>): FestivalValidationReport => {
    const defaultPermits: EssentialPermitStatus[] = [
      { key: 'municipal_report', label: '지자체 신고', status: 'INCOMPLETE', nodeId: 'fest-r3' },
      { key: 'police_road', label: '경찰 도로점용', status: 'MISSING', nodeId: 'fest-p2' },
      { key: 'fire_safety', label: '소방 안전점검', status: 'MISSING', nodeId: 'fest-p3' },
      { key: 'safety_plan', label: '안전관리계획서', status: 'VERIFIED', nodeId: 'fest-p1' }
    ];

    const defaultBudgetValidation: BudgetValidationReport = {
      scaleStatus: 'IN_SCALE',
      targetScaleMin: 50000000,
      targetScaleMax: 70000000,
      totalAllocated: 60000000,
      totalSpent: 60000000,
      spendRatio: 100,
      overrunCategories: [],
      unenteredDomains: []
    };

    const defaultRiskNodesMap = new Map<string, { riskLevel: 'CRITICAL' | 'WARNING'; reason: string }>([
      ['fest-p2', { riskLevel: 'CRITICAL', reason: '경찰 도로점용 필수 인허가 서류 누락' }],
      ['fest-p3', { riskLevel: 'CRITICAL', reason: '소방 안전점검 필수 인허가 서류 누락' }],
      ['fest-r3', { riskLevel: 'WARNING', reason: '지자체 신고 인허가 검증 미완료' }]
    ]);

    return {
      permits: defaultPermits,
      budgetValidation: defaultBudgetValidation,
      riskNodesMap: defaultRiskNodesMap,
      overallRiskLevel: 'CRITICAL',
      injectMissingPermits: jest.fn(),
      ...overrides
    };
  };

  // =========================================================================
  // TEST 1: DetectiveValidationHUD Rendering & Permit Badge Colors
  // =========================================================================
  describe('1. DetectiveValidationHUD Rendering & Permit Badge Colors', () => {
    it('renders top banner, risk badge, permit pills, and budget progress bar', () => {
      const report = createMockReport();
      render(<DetectiveValidationHUD report={report} />);

      // Title & Risk Badge
      expect(screen.getByText(/마인드맵 실시간 검증 HUD/i)).toBeInTheDocument();
      expect(screen.getByText(/🔴 CRITICAL RISK \/ 비상 경고/i)).toBeInTheDocument();

      // Permit Checklist Pills
      expect(screen.getByText('지자체 신고')).toBeInTheDocument();
      expect(screen.getByText('경찰 도로점용')).toBeInTheDocument();
      expect(screen.getByText('소방 안전점검')).toBeInTheDocument();
      expect(screen.getByText('안전관리계획서')).toBeInTheDocument();

      // Permit Status Text
      expect(screen.getByText('검토중')).toBeInTheDocument(); // INCOMPLETE
      expect(screen.getAllByText('미비/누락')).toHaveLength(2); // MISSING x2
      expect(screen.getByText('검증완료')).toBeInTheDocument(); // VERIFIED

      // Completed Count Counter
      expect(screen.getByText('1 / 4 완료')).toBeInTheDocument();
    });

    it('renders WARNING risk badge when overallRiskLevel is WARNING', () => {
      const report = createMockReport({ overallRiskLevel: 'WARNING' });
      render(<DetectiveValidationHUD report={report} />);
      expect(screen.getByText(/🟡 WARNING \/ 검토 주의/i)).toBeInTheDocument();
    });

    it('renders SAFE risk badge when overallRiskLevel is SAFE', () => {
      const report = createMockReport({ overallRiskLevel: 'SAFE' });
      render(<DetectiveValidationHUD report={report} />);
      expect(screen.getByText(/🟢 SAFE \/ 검증완료/i)).toBeInTheDocument();
    });

    it('correctly maps status badge colors for VERIFIED, INCOMPLETE, and MISSING', () => {
      const report = createMockReport();
      render(<DetectiveValidationHUD report={report} />);

      // VERIFIED pill badge styling check (emerald)
      const verifiedBadge = screen.getByText('검증완료');
      expect(verifiedBadge.className).toContain('bg-emerald-500/20');
      expect(verifiedBadge.className).toContain('text-emerald-400');

      // INCOMPLETE pill badge styling check (amber)
      const incompleteBadge = screen.getByText('검토중');
      expect(incompleteBadge.className).toContain('bg-amber-500/20');
      expect(incompleteBadge.className).toContain('text-amber-400');

      // MISSING pill badge styling check (red)
      const missingBadges = screen.getAllByText('미비/누락');
      missingBadges.forEach(badge => {
        expect(badge.className).toContain('bg-red-500/20');
        expect(badge.className).toContain('text-red-400');
      });
    });
  });

  // =========================================================================
  // TEST 2: Budget Scale Progress Bar Percentage Calculation & Bounds
  // =========================================================================
  describe('2. Budget Scale Progress Bar Percentage Calculation', () => {
    it('calculates progress percentage correctly for IN_SCALE (60M KRW -> 86%)', () => {
      const report = createMockReport({
        budgetValidation: {
          scaleStatus: 'IN_SCALE',
          targetScaleMin: 50000000,
          targetScaleMax: 70000000,
          totalAllocated: 60000000,
          totalSpent: 60000000,
          spendRatio: 100,
          overrunCategories: [],
          unenteredDomains: []
        }
      });

      const { container } = render(<DetectiveValidationHUD report={report} />);
      
      // 60M / 70M * 100 = 85.714... -> Math.round = 86%
      const progressBar = container.querySelector('.h-full.transition-all');
      expect(progressBar).toHaveStyle({ width: '86%' });
      expect(screen.getByText('🟢 적정 (5~7천만)')).toBeInTheDocument();
      expect(screen.getByText('6,000만원')).toBeInTheDocument();
    });

    it('calculates progress percentage correctly for UNDER_SCALE (40M KRW -> 57%)', () => {
      const report = createMockReport({
        budgetValidation: {
          scaleStatus: 'UNDER_SCALE',
          targetScaleMin: 50000000,
          targetScaleMax: 70000000,
          totalAllocated: 40000000,
          totalSpent: 40000000,
          spendRatio: 67,
          overrunCategories: [],
          unenteredDomains: []
        }
      });

      const { container } = render(<DetectiveValidationHUD report={report} />);
      
      // 40M / 70M * 100 = 57.142... -> Math.round = 57%
      const progressBar = container.querySelector('.h-full.transition-all');
      expect(progressBar).toHaveStyle({ width: '57%' });
      expect(screen.getByText('🟡 5천만원 미달')).toBeInTheDocument();
      expect(screen.getByText('4,000만원')).toBeInTheDocument();
    });

    it('clamps progress percentage to 100% when totalAllocated exceeds 70M KRW (OVER_SCALE 85M -> 100%)', () => {
      const report = createMockReport({
        budgetValidation: {
          scaleStatus: 'OVER_SCALE',
          targetScaleMin: 50000000,
          targetScaleMax: 70000000,
          totalAllocated: 85000000,
          totalSpent: 85000000,
          spendRatio: 142,
          overrunCategories: ['무대/공연/음향'],
          unenteredDomains: []
        }
      });

      const { container } = render(<DetectiveValidationHUD report={report} />);
      
      // 85M > 70M -> clamped to 100%
      const progressBar = container.querySelector('.h-full.transition-all');
      expect(progressBar).toHaveStyle({ width: '100%' });
      expect(screen.getByText('🔴 7천만원 초과')).toBeInTheDocument();
      expect(screen.getByText('8,500만원')).toBeInTheDocument();
    });

    it('handles 0 KRW allocated correctly (0%)', () => {
      const report = createMockReport({
        budgetValidation: {
          scaleStatus: 'UNDER_SCALE',
          targetScaleMin: 50000000,
          targetScaleMax: 70000000,
          totalAllocated: 0,
          totalSpent: 0,
          spendRatio: 0,
          overrunCategories: [],
          unenteredDomains: ['인허가/안전관리', '무대/공연/음향']
        }
      });

      const { container } = render(<DetectiveValidationHUD report={report} />);
      const progressBar = container.querySelector('.h-full.transition-all');
      expect(progressBar).toHaveStyle({ width: '0%' });
      expect(screen.getByText('0만원')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // TEST 3: 1-Click Auto-Injection Button Trigger
  // =========================================================================
  describe('3. 1-Click Auto-Injection Button Trigger', () => {
    it('executes injectMissingPermits callback when ⚡ 버튼 is clicked', () => {
      const mockInjectFn = jest.fn();
      const report = createMockReport({ injectMissingPermits: mockInjectFn });

      render(<DetectiveValidationHUD report={report} />);

      const autoInjectBtn = screen.getByRole('button', { name: /필수 인허가 4종 자동 보완/i });
      expect(autoInjectBtn).toBeInTheDocument();

      fireEvent.click(autoInjectBtn);
      expect(mockInjectFn).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // TEST 4: Node Crimson Risk Aura Rendering Math & Physics Bounds
  // =========================================================================
  describe('4. Canvas Crimson Risk Aura Physics & Color Math', () => {
    it('verifies sinusoidal pulse math bounds [0.5, 1.0] and alpha bounds [0.75, 1.0]', () => {
      const testTimestamps = [0, 100, 500, 1000, 2000, 5000, 123456789];
      testTimestamps.forEach(ts => {
        const pulse = 0.5 + 0.5 * Math.sin(ts * 0.005);
        expect(pulse).toBeGreaterThanOrEqual(0);
        expect(pulse).toBeLessThanOrEqual(1);

        const alpha = 0.75 + 0.25 * pulse;
        expect(alpha).toBeGreaterThanOrEqual(0.75);
        expect(alpha).toBeLessThanOrEqual(1.0);

        const localZoom = 1.2;
        const shadowBlur = (18 + 12 * pulse) * localZoom;
        expect(shadowBlur).toBeGreaterThanOrEqual(18 * localZoom);
        expect(shadowBlur).toBeLessThanOrEqual(30 * localZoom);

        const lineWidth = (3.5 + 1.5 * pulse) * localZoom;
        expect(lineWidth).toBeGreaterThanOrEqual(3.5 * localZoom);
        expect(lineWidth).toBeLessThanOrEqual(5.0 * localZoom);
      });
    });
  });

  // =========================================================================
  // TEST 5: Preset & Schema Boundary Empirical Validation
  // =========================================================================
  describe('5. Preset & Schema Boundaries', () => {
    it('verifies FESTIVAL_5DOMAINS dataset has exactly 5 domain hubs and all mandatory permit keys', () => {
      expect(FESTIVAL_5DOMAINS).toHaveLength(5);
      
      const permitKeysInPreset = new Set<string>();
      FESTIVAL_5DOMAINS.forEach(hub => {
        hub.children.forEach(child => {
          if (child.permitKey) {
            permitKeysInPreset.add(child.permitKey);
          }
        });
      });

      expect(permitKeysInPreset.has('municipal_report')).toBe(true);
      expect(permitKeysInPreset.has('police_road')).toBe(true);
      expect(permitKeysInPreset.has('fire_safety')).toBe(true);
      expect(permitKeysInPreset.has('safety_plan')).toBe(true);
    });
  });

});
