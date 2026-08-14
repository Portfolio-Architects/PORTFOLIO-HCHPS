'use client';

import { useMemo, useCallback } from 'react';
import { useGraphCustomization } from '@/hooks/useGraphCustomization';
import { useTasks } from '@/hooks/useTasks';
import { useBudgetSimulator } from '@/hooks/useBudgetSimulator';
import { FESTIVAL_5DOMAINS } from '@/lib/presets/festival5DomainPreset';
import { VerificationStatus } from '@/lib/ontology.types';

export interface EssentialPermitStatus {
  key: 'municipal_report' | 'police_road' | 'fire_safety' | 'safety_plan';
  label: string;
  status: 'MISSING' | 'INCOMPLETE' | 'VERIFIED';
  taskId?: string;
  nodeId?: string;
}

export interface BudgetValidationReport {
  scaleStatus: 'UNDER_SCALE' | 'IN_SCALE' | 'OVER_SCALE';
  targetScaleMin: number; // 50,000,000 KRW
  targetScaleMax: number; // 70,000,000 KRW
  totalAllocated: number;
  totalSpent: number;
  spendRatio: number;
  overrunCategories: string[];
  unenteredDomains: string[];
}

export interface FestivalValidationReport {
  permits: EssentialPermitStatus[];
  budgetValidation: BudgetValidationReport;
  riskNodesMap: Map<string, { riskLevel: 'CRITICAL' | 'WARNING'; reason: string }>;
  overallRiskLevel: 'CRITICAL' | 'WARNING' | 'SAFE';
  injectMissingPermits: () => void;
}

const MANDATORY_PERMITS: Array<{
  key: 'municipal_report' | 'police_road' | 'fire_safety' | 'safety_plan';
  label: string;
  nodeId: string;
  nodeLabel: string;
  domainHubId: string;
  defaultBudget: number;
  keywords: string[];
}> = [
  {
    key: 'municipal_report',
    label: '지자체 신고',
    nodeId: 'fest-r3',
    nodeLabel: '지자체 보도자료/현장취재',
    domainHubId: 'festival-hub-pr',
    defaultBudget: 1000000,
    keywords: ['지자체', '보도자료', '지자체 신고', '공보관']
  },
  {
    key: 'police_road',
    label: '경찰 도로점용',
    nodeId: 'fest-p2',
    nodeLabel: '경찰서 도로점용/교통신고',
    domainHubId: 'festival-hub-permits',
    defaultBudget: 500000,
    keywords: ['경찰', '도로점용', '교통신고', '경찰서']
  },
  {
    key: 'fire_safety',
    label: '소방 안전점검',
    nodeId: 'fest-p3',
    nodeLabel: '소방서 가설물 안전점검',
    domainHubId: 'festival-hub-permits',
    defaultBudget: 1000000,
    keywords: ['소방', '안전점검', '소방서', '가설물']
  },
  {
    key: 'safety_plan',
    label: '안전관리계획서',
    nodeId: 'fest-p1',
    nodeLabel: '안전관리계획서 수립/제출',
    domainHubId: 'festival-hub-permits',
    defaultBudget: 1500000,
    keywords: ['안전관리계획', '안전관리계획서', '재난안전']
  }
];

const FESTIVAL_DOMAINS = ['인허가/안전관리', '무대/공연/음향', '홍보/마케팅', '먹거리/부스', '예산/계약'];

export function useFestivalValidation(): FestivalValidationReport {
  const { customNodes, overrides, batchSetNodeOverrides, addCustomNode } = useGraphCustomization();
  const { tasks, updateTask } = useTasks();
  const { entries, addEntry, projectSummaries } = useBudgetSimulator();

  // Combine customNodes and preset nodes
  const allNodesMap = useMemo(() => {
    const map = new Map<string, { id: string; label: string; verificationStatus?: VerificationStatus; permitKey?: string }>();
    
    // Preset nodes
    FESTIVAL_5DOMAINS.forEach(hub => {
      map.set(hub.id, { id: hub.id, label: hub.label, verificationStatus: overrides[hub.id]?.verificationStatus || 'in-progress' });
      hub.children.forEach(child => {
        map.set(child.id, {
          id: child.id,
          label: child.label,
          verificationStatus: overrides[child.id]?.verificationStatus || child.verificationStatus || 'uncompleted',
          permitKey: child.permitKey
        });
      });
    });

    // Custom nodes
    customNodes.forEach(node => {
      const ov = overrides[node.id];
      map.set(node.id, {
        id: node.id,
        label: node.label,
        verificationStatus: ov?.verificationStatus || (node as any).verificationStatus || 'uncompleted',
        permitKey: (node as any).permitKey
      });
    });

    return map;
  }, [customNodes, overrides]);

  // 1. Evaluate Permits Status
  const permits = useMemo<EssentialPermitStatus[]>(() => {
    return MANDATORY_PERMITS.map(config => {
      let matchedNodeId: string | undefined;
      let matchedTaskId: string | undefined;
      let nodeExists = false;
      let nodeIsVerified = false;
      let taskExists = false;
      let taskIsDone = false;

      // Search matching node
      for (const [id, node] of Array.from(allNodesMap.entries())) {
        const isIdMatch = id === config.nodeId;
        const isPermitKeyMatch = node.permitKey === config.key;
        let isLabelMatch = false;
        for (let i = 0; i < config.keywords.length; i++) {
          if (node.label.includes(config.keywords[i])) {
            isLabelMatch = true;
            break;
          }
        }

        if (isIdMatch || isPermitKeyMatch || isLabelMatch) {
          matchedNodeId = id;
          nodeExists = true;
          const status = overrides[id]?.verificationStatus || node.verificationStatus || 'uncompleted';
          if (status === 'verified') {
            nodeIsVerified = true;
          }
          break;
        }
      }

      // Search matching task
      for (let k = 0; k < tasks.length; k++) {
        const t = tasks[k];
        let isTitleMatch = false;
        for (let i = 0; i < config.keywords.length; i++) {
          if (t.title.includes(config.keywords[i])) {
            isTitleMatch = true;
            break;
          }
        }
        if (isTitleMatch) {
          matchedTaskId = t.id;
          taskExists = true;
          if (t.status === 'done') {
            taskIsDone = true;
          }
          break;
        }
      }

      let status: 'MISSING' | 'INCOMPLETE' | 'VERIFIED' = 'MISSING';
      if (nodeIsVerified || taskIsDone) {
        status = 'VERIFIED';
      } else if (nodeExists || taskExists) {
        status = 'INCOMPLETE';
      } else {
        status = 'MISSING';
      }

      return {
        key: config.key,
        label: config.label,
        status,
        taskId: matchedTaskId,
        nodeId: matchedNodeId
      };
    });
  }, [allNodesMap, overrides, tasks]);

  // 2. Budget Validation Report
  const budgetValidation = useMemo<BudgetValidationReport>(() => {
    const targetScaleMin = 50000000; // 50M KRW
    const targetScaleMax = 70000000; // 70M KRW

    // Total allocated from simulation entries or preset budget entries
    let totalAllocated = 0;
    for (let i = 0; i < entries.length; i++) {
      totalAllocated += entries[i].amount || 0;
    }

    // If entries is empty, sum preset budgets
    if (totalAllocated === 0) {
      for (let i = 0; i < FESTIVAL_5DOMAINS.length; i++) {
        const hub = FESTIVAL_5DOMAINS[i];
        for (let j = 0; j < hub.children.length; j++) {
          totalAllocated += hub.children[j].budget || 0;
        }
      }
    }

    const totalSpent = totalAllocated; // Sum of planned/simulated expenditure

    let scaleStatus: 'UNDER_SCALE' | 'IN_SCALE' | 'OVER_SCALE' = 'IN_SCALE';
    if (totalAllocated < targetScaleMin) {
      scaleStatus = 'UNDER_SCALE';
    } else if (totalAllocated > targetScaleMax) {
      scaleStatus = 'OVER_SCALE';
    } else {
      scaleStatus = 'IN_SCALE';
    }

    const spendRatio = targetScaleMax > 0 ? Math.round((totalAllocated / 60000000) * 100) : 0;

    // Overrun Categories & Deficits
    const overrunCategories: string[] = [];
    for (let i = 0; i < projectSummaries.length; i++) {
      const ps = projectSummaries[i];
      if (ps.isDeficit || ps.finalExpectedBalance < 0) {
        overrunCategories.push(ps.detailedProject);
      }
    }

    // Unentered Domains
    const domainAmounts: Record<string, number> = {};
    for (let i = 0; i < FESTIVAL_DOMAINS.length; i++) {
      domainAmounts[FESTIVAL_DOMAINS[i]] = 0;
    }

    // Sum entries by matching keywords or department
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const dp = e.detailedProject || '';
      const memo = e.memo || '';
      const name = e.name || '';
      for (let j = 0; j < FESTIVAL_DOMAINS.length; j++) {
        const d = FESTIVAL_DOMAINS[j];
        if (dp.includes(d) || memo.includes(d) || name.includes(d)) {
          domainAmounts[d] += e.amount || 0;
        }
      }
    }

    // Also check mindmap node departments
    for (const [, node] of Array.from(allNodesMap.entries())) {
      const ov = overrides[node.id];
      const dept = ov?.story5W1H?.department || '';
      if (dept && domainAmounts[dept] !== undefined) {
        domainAmounts[dept] += 1;
      }
    }

    const unenteredDomains: string[] = [];
    for (let i = 0; i < FESTIVAL_DOMAINS.length; i++) {
      const d = FESTIVAL_DOMAINS[i];
      if (domainAmounts[d] === 0) {
        unenteredDomains.push(d);
      }
    }

    return {
      scaleStatus,
      targetScaleMin,
      targetScaleMax,
      totalAllocated,
      totalSpent,
      spendRatio,
      overrunCategories,
      unenteredDomains
    };
  }, [entries, projectSummaries, allNodesMap, overrides]);

  // 3. Risk Nodes Map & Overall Risk Level
  const riskNodesMap = useMemo(() => {
    const map = new Map<string, { riskLevel: 'CRITICAL' | 'WARNING'; reason: string }>();

    // Permit missing or incomplete nodes
    permits.forEach(p => {
      if (p.status === 'MISSING' && p.nodeId) {
        map.set(p.nodeId, { riskLevel: 'CRITICAL', reason: `${p.label} 필수 인허가 서류 누락` });
      } else if (p.status === 'INCOMPLETE' && p.nodeId) {
        map.set(p.nodeId, { riskLevel: 'WARNING', reason: `${p.label} 인허가 검증 미완료 (절차 진행중)` });
      }
    });

    // Nodes with verificationStatus === 'risk-warning'
    for (const [id, node] of Array.from(allNodesMap.entries())) {
      const ov = overrides[id];
      const vStatus = ov?.verificationStatus || node.verificationStatus;
      if (vStatus === 'risk-warning') {
        map.set(id, { riskLevel: 'CRITICAL', reason: '검토자 지정 위험 경고 노드' });
      }
    }

    return map;
  }, [permits, allNodesMap, overrides]);

  // Overall Risk Level
  const overallRiskLevel = useMemo<'CRITICAL' | 'WARNING' | 'SAFE'>(() => {
    let hasMissingPermit = false;
    let hasIncompletePermit = false;
    for (let i = 0; i < permits.length; i++) {
      if (permits[i].status === 'MISSING') hasMissingPermit = true;
      if (permits[i].status === 'INCOMPLETE') hasIncompletePermit = true;
    }

    let hasCriticalRiskNode = false;
    let hasWarningRiskNode = false;
    for (const r of Array.from(riskNodesMap.values())) {
      if (r.riskLevel === 'CRITICAL') hasCriticalRiskNode = true;
      if (r.riskLevel === 'WARNING') hasWarningRiskNode = true;
    }

    const isOverScale = budgetValidation.scaleStatus === 'OVER_SCALE';
    const isUnderScale = budgetValidation.scaleStatus === 'UNDER_SCALE';

    if (hasMissingPermit || hasCriticalRiskNode || isOverScale) {
      return 'CRITICAL';
    }

    if (hasIncompletePermit || hasWarningRiskNode || isUnderScale) {
      return 'WARNING';
    }

    return 'SAFE';
  }, [permits, riskNodesMap, budgetValidation.scaleStatus]);

  // 4. Inject Missing Permits Function
  const injectMissingPermits = useCallback(() => {
    const updates: Record<string, any> = {};
    const permitStateMap = new Map(permits.map(p => [p.key, p]));

    for (let i = 0; i < MANDATORY_PERMITS.length; i++) {
      const config = MANDATORY_PERMITS[i];
      const permitState = permitStateMap.get(config.key);
      const targetNodeId = permitState?.nodeId || config.nodeId;

      // 1. Ensure node exists and set verificationStatus to 'verified'
      if (allNodesMap.has(targetNodeId)) {
        updates[targetNodeId] = {
          verificationStatus: 'verified',
          permitKey: config.key
        };
      } else {
        // Node is missing entirely: create custom node
        const newNode = addCustomNode(config.nodeLabel, 0, -200, '#FF0044', 'SYSTEM_RISK', 80, 2);
        updates[newNode.id] = {
          verificationStatus: 'verified',
          customParent: config.domainHubId,
          permitKey: config.key,
          story5W1H: {
            what: config.nodeLabel,
            why: `${config.label} 자동 보완 필증`,
            department: '인허가/안전관리'
          }
        };
      }

      // 2. If matching task exists, update task status to 'done'
      if (permitState?.taskId) {
        updateTask(permitState.taskId, { status: 'done' });
      }

      // 3. Ensure simulation entry exists in budget simulator
      let entryExists = false;
      for (let j = 0; j < entries.length; j++) {
        const eName = entries[j].name || '';
        if (eName.includes(config.label) || eName.includes(config.nodeLabel)) {
          entryExists = true;
          break;
        }
      }

      if (!entryExists) {
        addEntry({
          name: config.nodeLabel,
          detailedProject: '건강생활실천사업(건강증진)',
          statItem: config.key === 'fire_safety' ? '201-02 공공운영비' : '201-01 사무관리비',
          unitPrice: config.defaultBudget,
          quantity: 1,
          amount: config.defaultBudget,
          memo: `${config.label} 필수 인허가 시뮬레이션 항목 자동 보완`
        });
      }
    }

    if (Object.keys(updates).length > 0) {
      batchSetNodeOverrides(updates);
    }
  }, [permits, allNodesMap, addCustomNode, batchSetNodeOverrides, updateTask, entries, addEntry]);

  return {
    permits,
    budgetValidation,
    riskNodesMap,
    overallRiskLevel,
    injectMissingPermits
  };
}
