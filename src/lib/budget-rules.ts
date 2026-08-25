/**
 * Budget Compliance Rules (예산 지침 컴플라이언스 엔진)
 * 통합건강증진사업 지침 및 재무회계 규칙에 의거한 예산 생성 및 지출 검증 로직.
 */

export interface ValidationResult {
  valid: boolean;
  message?: string;
  type?: 'error' | 'warning' | 'confirm';
}

const FORBIDDEN_PURPOSE_REGEX = /자산취득|컴퓨터|장비/;
const FORBIDDEN_CATEGORY_REGEX = /자산취득비|인건비/;
const ADVISORY_PURPOSE_REGEX = /자문료|속기료|사례금|수수료/;
const OPERATING_EXPENSE_REGEX = /일반수용비|210-01/;
const TEMPORARY_LABOR_REGEX = /일용임금|행정보조/;

export const BudgetRules = {
  /**
   * 예산 과목 생성 시 국비/지방비(시비) 매칭 비율 검증
   * @param total 총 예산액
   * @param national 국비 입력액
   * @param local 지방비 입력액
   */
  validateMatchingFund(total: number, national: number, local: number): ValidationResult {
    if (national + local !== total) {
      return { valid: false, message: '국비와 지방비의 합이 총 예산과 일치하지 않습니다.', type: 'error' };
    }
    const natRatio = national / total;
    if (Math.abs(natRatio - 0.3) > 0.05) {
      return { 
        valid: true, // It's just a warning, doesn't hard block unless the user cancels
        message: '서울시 통합건강증진사업 지침에 따른 [국비 30% : 지방비 70%] 매칭 비율을 충족하지 않습니다. 계속 진행하시겠습니까?', 
        type: 'confirm' 
      };
    }
    return { valid: true };
  },

  /**
   * 예산품의 (지출) 등록 시 컴플라이언스 룰 검증
   */
  validateEntryCompliance(purpose: string, categoryName: string): ValidationResult {
    // 1. 금지 비목 차단 (블랙리스트)
    if (FORBIDDEN_PURPOSE_REGEX.test(purpose) || FORBIDDEN_CATEGORY_REGEX.test(categoryName)) {
      return { 
        valid: false, 
        message: '통합건강증진사업 지침상 자산취득성 사업비 및 인건비 편성이 불가합니다.', 
        type: 'error' 
      };
    }

    // 2. 오분류 방지
    if (ADVISORY_PURPOSE_REGEX.test(purpose)) {
      if (!OPERATING_EXPENSE_REGEX.test(categoryName)) {
        return { 
          valid: false, 
          message: "지침 위반. 전문가 자문 등은 반드시 '일반수용비(210-01목)'로 집행해야 합니다.", 
          type: 'error' 
        };
      }
    }

    // 3. 편법 지출 방지 경고
    if (TEMPORARY_LABOR_REGEX.test(purpose)) {
      return { 
        valid: true, 
        message: "계속 고용 금지 및 중복 계상 금지 지침 재확인 요망. 불필요한 일용인력 계속 고용은 감사 대상입니다. 계속 진행할까요?", 
        type: 'confirm' 
      };
    }

    return { valid: true };
  }
};
