import os
import sys
import re
import shutil
import datetime
import zipfile
import json
import hashlib
import math
import difflib
from typing import Dict, List, Any

# HWPX, PDF, XLSX 파싱 라이브러리 임포트 가드
try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

# Windows UTF-8 입출력 강제
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = r"F:\부엉이_정리됨"
CACHE_PATH = os.path.join(ROOT_DIR, ".search_cache.json")

# 중요도에 따른 키워드 구분 (30점 고유 핵심어 / 10점 범용 수식어 / 20점 일반키워드)
HIGH_PRIORITY_KEYWORDS = {
    "01_강남_AI_메디헬스_센터": ["헬스체크업", "체력인증센터", "메디헬스", "소울소프트", "인바디", "대사증후군"],
    "02_바른자세_개선_사업": ["바른자세", "척추측만증", "거북목"],
    "03_양재천_건강걷기_및_걷자페스티벌": ["양재천", "걷자페스티벌", "건강걷기"],
    "04_건강뜀_및_비만예방": ["건강 뜀", "비만예방교실", "영양교실"],
    "05_아이뛰움_및_어린이신체활동증진": ["아이뛰움", "어린이 신체활동", "에듀하이", "아이트라움"],
    "06_교육_자료_제작": ["리플릿 제작", "리플렛 제작", "용품 제작", "교구 제작", "소식지"],
    "07_인사_관련_서류": ["근무성적", "시간선택제", "기여금", "경력증명"],
    "09_주간 및 월간 계획": ["주요업무보고", "실적 및 계획", "문의사항_답변"]
}

LOW_PRIORITY_KEYWORDS = {
    "01_강남_AI_메디헬스_센터": ["예산", "계획", "회의", "대금"],
    "02_바른자세_개선_사업": ["자세", "검사", "교육"],
    "03_양재천_건강걷기_및_걷자페스티벌": ["걷기", "행사", "계획"],
    "04_건강뜀_및_비만예방": ["비만", "영양", "교실"],
    "05_아이뛰움_및_어린이신체활동증진": ["어린이", "신체활동", "교구"],
    "06_교육_자료_제작": ["리플릿", "리플렛", "시안", "배너", "인쇄", "제작", "계약"],
    "07_인사_관련_서류": ["인사", "성과", "채용", "복무", "급여", "인력"],
    "09_주간 및 월간 계획": ["주간", "월간", "일간", "실적", "계획", "보고", "일지", "출장", "공약"]
}

KNOWN_THEME_KEYWORDS = {
    "01_강남_AI_메디헬스_센터": ["체력장", "체력인증", "헬스체크업", "체크업", "메디헬스", "인바디", "체지방", "소울소프트", "공공PT", "공공 PT", "공공피티", "만성질환", "대사증후군", "심뇌혈관", "고혈압", "당뇨", "가구", "체지방계", "특별조정교부금", "아대", "대금수령", "납품검사원_아대"],
    "02_바른자세_개선_사업": ["바른자세", "자세", "척추", "측만증", "체형", "거북목"],
    "03_양재천_건강걷기_및_걷자페스티벌": ["양재천", "걷기", "걷자", "페스티벌", "건강걷기"],
    "04_건강뜀_및_비만예방": ["건강 뜀", "뜀", "비만", "비만예방", "예방교실", "영양교실", "영양"],
    "05_아이뛰움_및_어린이신체활동증진": ["아이뛰움", "어린이", "신체활동 증진", "어린이 신체활동", "에듀하이", "아이트라움"],
    "06_교육_자료_제작": ["리플릿", "리플렛", "책자", "브로셔", "브로슈어", "인쇄물", "소식지", "콘텐츠", "컨텐츠", "교육 자료", "홍보물", "캘린더", "달력", "다이어리", "용품 제작", "물품 제작", "교구 제작", "제작 계약", "용품제작", "물품제작", "교구제작", "제작계약"],
    "07_인사_관련_서류": ["성과목표", "성과평가", "근무성적", "평정", "시간선택제", "채용", "복무", "인사", "성과계획", "호봉", "급여", "경력증명", "기여금", "공무원", "인력", "초과근무"],
    "08_기타_일반행정": [],
    "09_주간 및 월간 계획": ["주간", "월간", "일간", "주요업무보고", "행사계획", "실적 및 계획", "주간업무", "월간업무", "일간업무", "업무실적", "업무 보고", "업무보고", "업무일지", "일지", "일일업무", "출장근무", "문의사항_답변", "자치구 문의", "실적 현황", "실적현황", "공약사업", "관리카드", "주차 자치구"]
}

WORK_DOMAINS = {
    "01_수의계약": ["수의계약", "계약", "계약서", "용역계약", "물품계약", "과업지시서", "시방서", "수의계약 제한 여부 확인서", "업체 선정 평가 확인서", "사양서", "납품검사원", "납품검사", "물품사양서"],
    "02_일반지출": ["지출", "지출서류", "세금계산서", "계산서", "전자계산서", "산출내역서", "견적서", "타견적서", "청구서", "지급조서", "강사료 지급", "영수증", "입금계좌", "대금청구", "대금 청구", "계좌이체", "통장사본"],
    "03_일상경비": ["일상경비", "일상 경비", "여비", "출장여비", "이체내역", "지급조서(일상경비)", "여비 지급"],
    "07_주간 및 월간 계획": ["주간", "월간", "일간", "주요업무보고", "행사계획", "실적 및 계획", "주간업무", "월간업무", "일간업무", "업무실적", "업무 보고", "업무보고", "문의사항_답변", "자치구 문의", "실적 현황", "실적현황", "공약사업", "관리카드", "주차 자치구", "분기별", "분기", "업무일지", "일지", "일일업무", "출장근무"],
    "04_계획 및 방침": ["계획", "방침", "추진", "운영 계획", "사업 계획", "계획서", "방침서", "캠페인 운영", "회의 안건", "성과관리계획", "간주처리", "특별조정교부금", "예산재배정"],
    "05_디자인 시안": ["디자인", "시안", "리플렛 시안", "배너 시안", "리플릿 A안", "리플릿 표지", "로고", "BI", "도면", "패널", "배너", "배치도", "평면도", "간판", "리셉션", "백월", "현장사진"]
}

# 글로벌 캐시 저장소
global_cache = {}

def get_file_hash(filepath: str) -> str:
    """Compute the SHA-256 hash of a file in chunks."""
    hash_sha256 = hashlib.sha256()
    try:
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()
    except Exception:
        return ""

def calculate_cosine_similarity(text1: str, text2: str) -> float:
    """Calculate the cosine similarity between two text strings."""
    if not text1 or not text2:
        return 0.0
    words1 = re.findall(r'[가-힣\w]+', text1.lower())
    words2 = re.findall(r'[가-힣\w]+', text2.lower())
    if not words1 or not words2:
        return 0.0
    
    tf1 = {}
    tf2 = {}
    for w in words1:
        tf1[w] = tf1.get(w, 0) + 1
    for w in words2:
        tf2[w] = tf2.get(w, 0) + 1
        
    all_words = set(tf1.keys()).union(set(tf2.keys()))
    dot_product = 0.0
    sum_sq1 = 0.0
    sum_sq2 = 0.0
    for w in all_words:
        val1 = tf1.get(w, 0)
        val2 = tf2.get(w, 0)
        dot_product += val1 * val2
        sum_sq1 += val1 * val1
        sum_sq2 += val2 * val2
    if sum_sq1 == 0 or sum_sq2 == 0:
        return 0.0
    return dot_product / (math.sqrt(sum_sq1) * math.sqrt(sum_sq2))

def get_filename_similarity(name1: str, name2: str) -> float:
    """Calculate SequenceMatcher similarity on cleaned filenames."""
    n1 = os.path.splitext(name1)[0].lower()
    n2 = os.path.splitext(name2)[0].lower()
    
    n1_clean = re.sub(r"^\d{8}_", "", n1)
    n2_clean = re.sub(r"^\d{8}_", "", n2)
    
    # Strip keyword tag first
    n1_clean = re.sub(r"_\([^)]+\)$", "", n1_clean)
    n2_clean = re.sub(r"_\([^)]+\)$", "", n2_clean)
    
    n1_clean = re.sub(r"\([^)]+\)$", "", n1_clean)
    n2_clean = re.sub(r"\([^)]+\)$", "", n2_clean)
    
    return difflib.SequenceMatcher(None, n1_clean, n2_clean).ratio()

def clean_final_tag(filename: str) -> (str, bool):
    """Strip [최종] or ★최종★_ prefix if present, return cleaned filename and a boolean indicator."""
    has_final_tag = False
    name = filename
    while True:
        match = re.match(r"^(?:\[최종\]|★최종★_)[\s_\-]*", name)
        if match:
            has_final_tag = True
            name = name[match.end():]
        else:
            break
    return name, has_final_tag

def get_clean_base_filename(filename: str) -> str:
    """Repeatedly strip draft/version/final/duplicate/copy suffixes from the end of the filename,
    handling any trailing parenthesized summary."""
    name, ext = os.path.splitext(filename)
    
    # Strip keyword tag _(keyword1, keyword2, ...) from name
    name = re.sub(r"_\([^)]+\)$", "", name)
    
    # Check if there is a trailing parenthesized summary
    summary_match = re.search(r"(\([^)]+\))$", name)
    summary = ""
    if summary_match:
        summary = summary_match.group(1)
        name = name[:-len(summary)] # Strip the summary temporarily
        
    while True:
        prev = name
        # Strip trailing final keywords (case-insensitive, including English variants)
        name = re.sub(r"[\s_\-]+(?:최종안?|수정완료|제출용|배포용|복사본|copy|final|submit|dist)$", "", name, flags=re.IGNORECASE)
        # Strip trailing numbers with optional leading 'v'
        name = re.sub(r"[\s_\-]+(?:v)?\d+$", "", name, flags=re.IGNORECASE)
        name = re.sub(r"[\s_\-]+$", "", name)
        if name == prev:
            break
            
    return name + summary + ext

def extract_korean_keywords(content: str) -> List[str]:
    """Extract up to 4 most frequent Korean keywords from document content,
    applying particle-stripping and stopword filtering."""
    if not content:
        return []
    
    # 1. Regex-based tokenization of Korean words.
    words = re.findall(r'[가-힣]+', content)
    
    # 2. Particle stripping & stopword filtering
    particles = ['은', '는', '이', '가', '을', '를', '의', '에', '과', '와', '로', '으로', '에서', '부터', '까지', '하고']
    particles_sorted = sorted(particles, key=len, reverse=True)
    
    stopwords = {'및', '등', '경우', '내용', '결과', '보고', '계획', '사업', '현황'}
    
    freq = {}
    for word in words:
        # Strip particles
        stem = word
        for p in particles_sorted:
            if stem.endswith(p):
                # Ensure the particle stripping is done only if the resulting stem is at least 2 characters.
                potential_stem = stem[:-len(p)]
                if len(potential_stem) >= 2:
                    stem = potential_stem
                    break
        
        # Stopword filtering
        if stem in stopwords:
            continue
            
        # Only keep stems that are at least 2 characters long
        if len(stem) < 2:
            continue
            
        freq[stem] = freq.get(stem, 0) + 1
        
    # Sort by frequency descending, then alphabetically for stability
    sorted_keywords = sorted(freq.keys(), key=lambda k: (-freq[k], k))
    
    return sorted_keywords[:4]

def has_final_keyword(orig_filename: str, had_final_tag: bool) -> int:
    """Check if the filename contains final keywords or had a final tag originally,
    returning a score where strong keywords rank higher than copy/version tags."""
    if had_final_tag:
        return 2
    filename_lower = orig_filename.lower()
    
    # Strong final indicators
    strong_keywords = ['최종', '수정완료', '제출용', '배포용', 'final', 'submit', 'dist']
    for kw in strong_keywords:
        if kw in filename_lower:
            return 2
            
    # Weak revision/version/copy indicators
    weak_keywords = ['copy', '복사본']
    for kw in weak_keywords:
        if kw in filename_lower:
            return 1
            
    # Version numbers/suffixes
    name_part, _ = os.path.splitext(filename_lower)
    if re.search(r"[\s_\-]+(?:v)?\d+$", name_part):
        return 1
        
    return 0

def sync_cache_move(old_abs_path: str, new_abs_path: str, file_meta: dict):
    """Synchronize cache in real-time when moving/renaming a file."""
    global global_cache
    metadata = global_cache.pop(old_abs_path, {})
    
    try:
        if os.path.exists(new_abs_path):
            stat = os.stat(new_abs_path)
            metadata["mtime"] = int(stat.st_mtime * 1000)
            metadata["size"] = stat.st_size
        else:
            metadata["mtime"] = int(file_meta.get("mtime", 0) * 1000) if file_meta.get("mtime", 0) > 1000000 else int(file_meta.get("mtime", 0))
            metadata["size"] = file_meta.get("size", 0)
    except Exception:
        metadata["mtime"] = int(file_meta.get("mtime", 0) * 1000) if file_meta.get("mtime", 0) > 1000000 else int(file_meta.get("mtime", 0))
        metadata["size"] = file_meta.get("size", 0)
        
    metadata["content"] = file_meta.get("content", "")
    metadata["hash"] = file_meta.get("hash", "") or file_meta.get("hash_val", "")
    
    global_cache[new_abs_path] = metadata

def load_search_cache():
    """디스크에서 .search_cache.json 로드"""
    global global_cache
    if os.path.exists(CACHE_PATH):
        try:
            with open(CACHE_PATH, 'r', encoding='utf-8') as f:
                global_cache = json.load(f)
            print(f"[Cache Info] {len(global_cache)}개 캐시 항목 로드 완료.")
        except Exception as e:
            print(f"[Cache Warning] 캐시 로드 중 오류 발생: {e}")
            global_cache = {}
    else:
        print("[Cache Info] 캐시 파일이 존재하지 않습니다. 신규 작성 대기.")
        global_cache = {}

def save_search_cache():
    """디스크에 .search_cache.json 덤프"""
    global global_cache
    temp_path = CACHE_PATH + ".tmp"
    try:
        with open(temp_path, 'w', encoding='utf-8') as f:
            json.dump(global_cache, f, ensure_ascii=False, indent=2)
        if os.path.exists(CACHE_PATH):
            os.remove(CACHE_PATH)
        os.rename(temp_path, CACHE_PATH)
        print(f"[Cache Info] {len(global_cache)}개 캐시 데이터 동기화 및 저장 성공.")
    except Exception as e:
        print(f"[Cache Error] 캐시 저장 실패: {e}")
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

def parse_pdf_text(filepath: str) -> str:
    """PDF 파일 본문에서 첫 2000자 추출 (안전한 close 처리)"""
    if not fitz:
        return ""
    doc = None
    try:
        doc = fitz.open(filepath)
        text_list = []
        for page in list(doc)[:3]:
            text_list.append(page.get_text())
        return "\n".join(text_list)[:2000]
    except Exception:
        return ""
    finally:
        if doc:
            try:
                doc.close()
            except Exception:
                pass

def parse_hwpx_text(filepath: str) -> str:
    """HWPX 파일 본문에서 첫 2000자 추출"""
    try:
        with zipfile.ZipFile(filepath, 'r') as z:
            sections = [f for f in z.namelist() if f.startswith('Contents/section') and f.endswith('.xml')]
            text_list = []
            for section in sections[:3]:
                xml_content = z.read(section).decode('utf-8', errors='ignore')
                text = re.sub(r'<[^>]+>', ' ', xml_content)
                text = re.sub(r'\s+', ' ', text)
                text_list.append(text)
            return "\n".join(text_list)[:2000]
    except Exception:
        return ""

def extract_date_from_text(text: str) -> str:
    """텍스트 내에서 작성일자 YYYYMMDD 유추"""
    patterns = [
        r"(202\d)[\s\.\-\/]+(0?[1-9]|1[0-2])[\s\.\-\/]+(0?[1-9]|[12]\d|3[01])", 
        r"(202\d)년\s*(0?[1-9]|1[0-2])월\s*(0?[1-9]|[12]\d|3[01])일", 
        r"(202\d)[\s\.\-\/]+(0?[1-9]|1[0-2])" 
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            year = match.group(1)
            month = f"{int(match.group(2)):02d}"
            day = f"{int(match.group(3)):02d}" if len(match.groups()) >= 3 else "01"
            return f"{year}{month}{day}"
    return ""

def extract_date_from_filename(filename: str) -> str:
    """파일명 내부에서 날짜 정보 파싱"""
    match = re.search(r"(202\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])", filename)
    if match:
        return match.group(0)
    match = re.search(r"(202\d)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])", filename)
    if match:
        return match.group(1) + match.group(2) + match.group(3)
    match = re.search(r"(202\d)\.(0[1-9]|1[0-2])\.(0[1-9]|[12]\d|3[01])", filename)
    if match:
        return match.group(1) + match.group(2) + match.group(3)
    match = re.search(r"(202\d)년\s*(0?[1-9]|1[0-2])월", filename)
    if match:
        return f"{match.group(1)}{int(match.group(2)):02d}01"
    return ""

def extract_year_from_filename(filename: str) -> str:
    """파일명 내부에서 연도 파싱"""
    match = re.search(r"(202\d)", filename)
    if match:
        return match.group(1)
    match = re.search(r"(\d{2})년(?:도)?", filename)
    if match:
        val = int(match.group(1))
        if 20 <= val <= 29:
            return f"20{val}"
    return ""

def get_inferred_date_and_content(filepath: str, filename: str) -> (str, str, str):
    """캐시 연동형 날짜, 본문 텍스트 및 해시 반환"""
    global global_cache
    ext = os.path.splitext(filename)[1].lower()
    clean_filename = re.sub(r"^\d{8}_", "", filename)
    
    # 1. 캐시 대조 파이프라인
    cached_content = ""
    hash_val = ""
    use_cache = False
    try:
        stat = os.stat(filepath)
        mtime_ms = int(stat.st_mtime * 1000)
        size = stat.st_size
        
        # 캐시의 키는 절대 경로 기준
        abs_path = os.path.abspath(filepath)
        if abs_path in global_cache:
            cache_item = global_cache[abs_path]
            # mtime과 크기가 정확히 일치하는 경우 본문 파싱 비용 스킵
            if cache_item.get("mtime") == mtime_ms and cache_item.get("size") == size:
                cached_content = cache_item.get("content", "")
                hash_val = cache_item.get("hash", "")
                use_cache = True
    except Exception as e:
        print(f"[Cache Warning] stat 획득 오류: {e}")
        
    content = ""
    if use_cache:
        content = cached_content
        if not hash_val:
            hash_val = get_file_hash(filepath)
            try:
                global_cache[abs_path]["hash"] = hash_val
            except Exception:
                pass
    else:
        # 캐시가 만료되었거나 없을 시 실제 파싱 및 해시 계산 수행
        hash_val = get_file_hash(filepath)
        if ext == '.pdf':
            content = parse_pdf_text(filepath)
        elif ext == '.hwpx':
            content = parse_hwpx_text(filepath)
        
        # 신규 파싱 결과를 캐시 메모리에 보관
        try:
            abs_path = os.path.abspath(filepath)
            stat = os.stat(filepath)
            global_cache[abs_path] = {
                "mtime": int(stat.st_mtime * 1000),
                "size": stat.st_size,
                "content": content,
                "hash": hash_val
            }
        except Exception:
            pass

    # 날짜 유추 순서 적용
    # 2-1. 파일명 날짜 우선
    date_str = extract_date_from_filename(clean_filename)
    if date_str:
        return date_str, content, hash_val

    # 2-2. 파일명 연도 힌트
    hint_year = extract_year_from_filename(clean_filename)

    # 2-3. 본문 날짜 추출
    if content:
        date_str = extract_date_from_text(content)
        if date_str:
            if hint_year:
                if date_str.startswith(hint_year):
                    return date_str, content, hash_val
            else:
                return date_str, content, hash_val

    # 2-4. 연도 힌트 1월 1일 폴백
    if hint_year:
        return f"{hint_year}0101", content, hash_val

    # 2-5. 기존 날짜 접두사 보존
    orig_prefix_match = re.match(r"^(\d{8})_", filename)
    if orig_prefix_match:
        return orig_prefix_match.group(1), content, hash_val

    # 2-6. 최종 수정 시간
    try:
        mtime = os.path.getmtime(filepath)
        dt = datetime.datetime.fromtimestamp(mtime)
        return dt.strftime("%Y%m%d"), content, hash_val
    except Exception:
        return "20260101", content, hash_val

def get_theme_folder(filename: str, content: str) -> str:
    """고도화된 종합 가중치 누적 점수제 기반 테마 분류"""
    clean_filename = re.sub(r"^\d{8}_", "", filename)

    # 1. 파일명 수동 지정 접두사(01~09) 최우선 가드
    prefix_patterns = [
        r"^(0[1-9])[\s_\-]",
        r"^\[(0[1-9])\]",
        r"^(202\d{5})[\s_\-]+(0[1-9])[\s_\-]",
        r"^(202\d{5})[\s_\-]+\[(0[1-9])\]"
    ]
    
    theme_mapping = {
        "01": "01_강남_AI_메디헬스_센터",
        "02": "02_바른자세_개선_사업",
        "03": "03_양재천_건강걷기_및_걷자페스티벌",
        "04": "04_건강뜀_및_비만예방",
        "05": "05_아이뛰움_및_어린이신체활동증진",
        "06": "06_교육_자료_제작",
        "07": "07_인사_관련_서류",
        "08": "08_기타_일반행정",
        "09": "09_주간 및 월간 계획"
    }
    
    for pattern in prefix_patterns:
        match = re.search(pattern, filename)
        if match:
            code = match.group(2) if len(match.groups()) >= 2 else match.group(1)
            if code in theme_mapping:
                return theme_mapping[code]

    # 2. 가중치 점수 맵 초기화
    theme_scores = {theme: 0 for theme in theme_mapping.values()}
    
    # 2-1. 파일명 키워드 매칭 (중요도에 따른 차등 가중치: High 30, General 20, Low 10)
    for theme_name in theme_scores.keys():
        # High Priority Keywords (30점)
        for kw in HIGH_PRIORITY_KEYWORDS.get(theme_name, []):
            if kw.lower() in clean_filename.lower():
                theme_scores[theme_name] += 30
                
        # General Keywords (20점 - KNOWN_THEME_KEYWORDS 중 High/Low에 포함 안 된 것들)
        high_set = set(HIGH_PRIORITY_KEYWORDS.get(theme_name, []))
        low_set = set(LOW_PRIORITY_KEYWORDS.get(theme_name, []))
        for kw in KNOWN_THEME_KEYWORDS.get(theme_name, []):
            if kw not in high_set and kw not in low_set:
                if kw.lower() in clean_filename.lower():
                    theme_scores[theme_name] += 20
                    
        # Low Priority Keywords (10점)
        for kw in LOW_PRIORITY_KEYWORDS.get(theme_name, []):
            if kw.lower() in clean_filename.lower():
                theme_scores[theme_name] += 10

    # 2-2. 본문 빈도수 정규화 매칭 (본문 1000자당 출현 횟수로 밀도 환산)
    if content:
        text_len_k = max(1.0, len(content) / 1000.0)
        for theme_name, keywords in KNOWN_THEME_KEYWORDS.items():
            density_sum = 0
            for kw in keywords:
                count = len(re.findall(re.escape(kw), content, re.IGNORECASE))
                density_sum += count
            # 본문 길이 대비 출현 밀도에 3배 비례 점수 가산
            theme_scores[theme_name] += int((density_sum / text_len_k) * 3)

    # 2-3. 파일명 주간/계획 성격 15점 가산 보정
    plan_indicators = ["주간", "월간", "일간", "실적", "계획", "일지", "출장", "공약", "보고"]
    for ind in plan_indicators:
        if ind in clean_filename:
            theme_scores["09_주간 및 월간 계획"] += 15

    # 2-4. 오탐 방지용 페널티 및 초강력 감쇄 필터 (파일명에 명시되지 않은 단순 본문 언급 0.1배 극단 감쇄 + 10점 페널티)
    has_hr_in_filename = any(x in clean_filename for x in ["인사", "성과", "채용", "호봉", "근무성적", "평정", "복무", "급여", "기여금", "인력", "초과근무"])
    if not has_hr_in_filename and theme_scores["07_인사_관련_서류"] > 0:
        theme_scores["07_인사_관련_서류"] = int(theme_scores["07_인사_관련_서류"] * 0.1) - 10

    has_edu_in_filename = any(x in clean_filename for x in ["리플릿", "리플렛", "소식지", "인쇄물", "교육자료", "책자", "다이어리", "브로셔", "캘린더"])
    if not has_edu_in_filename and theme_scores["06_교육_자료_제작"] > 0:
        theme_scores["06_교육_자료_제작"] = int(theme_scores["06_교육_자료_제작"] * 0.1) - 10

    has_plan_in_filename = any(x in clean_filename for x in plan_indicators)
    if not has_plan_in_filename and theme_scores["09_주간 및 월간 계획"] > 0:
        theme_scores["09_주간 및 월간 계획"] = int(theme_scores["09_주간 및 월간 계획"] * 0.1) - 10

    # 3. 최고 점수 테마 도출
    max_score = 0
    selected_theme = "08_기타_일반행정"
    
    for theme, score in theme_scores.items():
        if theme == "08_기타_일반행정":
            continue
        if score > max_score:
            max_score = score
            selected_theme = theme
            
    if max_score <= 0:
        return "08_기타_일반행정"
        
    return selected_theme

def get_work_domain(filename: str, content: str) -> str:
    """3차 카테고리(업무 종류) 매핑"""
    for domain, keywords in WORK_DOMAINS.items():
        for kw in keywords:
            if kw in filename:
                return domain
    
    if content:
        domain_scores = {}
        for domain, keywords in WORK_DOMAINS.items():
            score = 0
            for kw in keywords:
                score += len(re.findall(re.escape(kw), content, re.IGNORECASE))
            if score > 0:
                domain_scores[domain] = score
        if domain_scores:
            return max(domain_scores, key=domain_scores.get)
            
    return "06_기타서류"

IS_API_QUOTA_EXHAUSTED = False

def load_env_local_key():
    proj_root = os.getcwd()
    env_path = os.path.join(proj_root, ".env.local")
    if os.path.exists(env_path):
        try:
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        if "=" in line:
                            key, val = line.split("=", 1)
                            key = key.strip()
                            val = val.strip().strip("'\"")
                            if key == "GOOGLE_GEMINI_API_KEY":
                                os.environ["GOOGLE_GEMINI_API_KEY"] = val
                                break
        except Exception:
            pass

def get_ai_content_summary(filename: str, content: str, target_work: str) -> str:
    """Gemini API 활용 요약문 추출"""
    global IS_API_QUOTA_EXHAUSTED
    if IS_API_QUOTA_EXHAUSTED:
        return ""
        
    load_env_local_key()
    api_key = os.environ.get("GOOGLE_GEMINI_API_KEY", "")
    if not api_key or not content:
        return ""
    
    text_slice = content[:1000].strip()
    if not text_slice:
        return ""

    name_no_ext = os.path.splitext(filename)[0]
    if re.search(r"\([^)]+\)$", name_no_ext):
        return ""
        
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        
        prompt = f"""당신은 문서 본문을 읽고 파일 이름 뒤에 붙일 핵심 요약 키워드(1~2단어)를 추출하는 AI 엔진입니다.
제공된 본문 일부를 읽고, 이 문서에서 가장 지배적인 [업체명, 대상기관/인물, 주요물품, 또는 핵심 안건]을 딱 한두 단어로 한국어로 짧고 강렬하게 요약해 주세요.

<규칙>
1. 답변은 다른 생각이나 서론, 결론 없이 오직 해당 요약 단어(들)만 출력하세요. (예: 메이플컴퍼니, 단대부중, KIOSK장비, 백월시안, 간주처리)
2. 괄호나 기호는 붙이지 말고 단어만 반환하세요.
3. 본문 텍스트가 매우 짧거나 알 수 없다면 아무것도 출력하지 마세요.

업무종류: {target_work}
원본 파일명: {filename}
본문 일부:
{text_slice}
"""
        model = genai.GenerativeModel('gemini-3.5-flash')
        response = model.generate_content(
            prompt,
            generation_config={"max_output_tokens": 15, "temperature": 0.1}
        )
        
        if not response.candidates or len(response.candidates) == 0 or not response.candidates[0].content or not response.candidates[0].content.parts:
            return ""
            
        summary = response.text.strip()
        summary = re.sub(r"[^\w\s\-_]", "", summary)
        summary = re.sub(r"\s+", "_", summary).strip("_")
        if len(summary) > 15:
            summary = summary[:15]
        return summary
    except Exception as e:
        err_msg = str(e)
        if "429" in err_msg or "quota" in err_msg.lower() or "limit" in err_msg.lower():
            IS_API_QUOTA_EXHAUSTED = True
            print(f"\n[AI 요약 알림] 제미니 API 일일 할당량 소진 감지 ➡️ 로컬 초고속 요약 엔진으로 자동 전환.\n")
        else:
            print(f"[AI 요약 에러] {filename}: {e}")
        return ""

def get_local_content_summary(filename: str, content: str, target_work: str) -> str:
    """로컬 초고속 요약 엔진 (정규식 고도화)"""
    if not content:
        return ""
        
    # 1. 예금주 / 상호 / 업체명 패턴 탐지
    company_match = re.search(r"([가-힣\w]{2,10}\(주\))|(\(주\)[가-힣\w]{2,10})|([가-힣\w]{2,10}\s?주식회사)|(주식회사\s?[가-힣\w]{2,10})", content)
    if company_match:
        comp = company_match.group(0).replace("주식회사", "").replace("(주)", "").strip()
        if comp and len(comp) >= 2:
            return comp

    meta_patterns = [
        r"예금주\s*[:\s]+([가-힣\w\s]{2,12})",
        r"상호(?:명)?\s*[:\s]+([가-힣\w\s]{2,12})",
        r"업체명\s*[:\s]+([가-힣\w\s]{2,12})",
        r"계좌이체\s+([가-힣\w\s]{2,12})",
        r"납품(?:처|자)\s*[:\s]+([가-힣\w\s]{2,12})",
        r"수급인\s*[:\s]+([가-힣\w\s]{2,12})"
    ]
    for pat in meta_patterns:
        match = re.search(pat, content)
        if match:
            val = match.group(1).strip().split()[0]
            if len(val) >= 2:
                return val

    # 2. 강남구 관내 학교명 및 공공 기관 패턴 매핑 고도화
    org_match = re.search(r"([가-힣]{2,10}(?:초등|중|고등)?학교)|([가-힣]{2,10}(?:보건소|센터|재단|의회|구청|의원))", content)
    if org_match:
        val = org_match.group(0).strip()
        if len(val) >= 2:
            return val

    # 3. 주요 직책자/주무관 인물명 탐지
    people = ["오창선", "신진성", "김태환", "김은주", "김형종", "김재은", "이영희", "홍길동"]
    for p in people:
        if p in content:
            return f"{p}주무관" if "출장" in filename or "근무" in filename or "출장" in content else p

    # 4. 주요 물품 키워드
    items = ["인바디", "리플렛", "리플릿", "배너", "배치도", "평면도", "식권", "수당", "공약사업", "키오스크", "백월", "다이어리", "현수막", "캘린더", "비품", "임대"]
    for item in items:
        if item in content or item in filename:
            return item

    return ""

def clean_empty_folders(path: str):
    """빈 폴더 재귀적 정리 (상위 루트 보존)"""
    theme_folders = list(KNOWN_THEME_KEYWORDS.keys()) + ["08_기타_일반행정"]
    for root, dirs, files in os.walk(path, topdown=False):
        for d in dirs:
            dir_path = os.path.join(root, d)
            if d in theme_folders:
                continue
            try:
                # 메타파일인 .search_cache.json 이나 desktop.ini 만 존재하거나 비어있는지 확인
                children = os.listdir(dir_path)
                safe_to_delete = True
                for child in children:
                    if child not in [".search_cache.json", "desktop.ini"]:
                        safe_to_delete = False
                        break
                if safe_to_delete:
                    # 메타파일이 있는 경우 먼저 삭제
                    for child in children:
                        try:
                            os.remove(os.path.join(dir_path, child))
                        except Exception:
                            pass
                    os.rmdir(dir_path)
                    print(f"🗑️  빈 폴더 삭제: {dir_path}")
            except Exception:
                pass

def resolve_filename_collision(dest_dir: str, filename: str, current_filepath: str = None) -> str:
    """파일명 중복 시 순차 번호 접미사(_1, _2...)를 주어 충돌 회피"""
    name, ext = os.path.splitext(filename)
    counter = 1
    new_filename = filename
    while os.path.exists(os.path.join(dest_dir, new_filename)):
        if current_filepath and os.path.abspath(os.path.join(dest_dir, new_filename)) == os.path.abspath(current_filepath):
            break
        new_filename = f"{name}_{counter}{ext}"
        counter += 1
    return new_filename

def main():
    global global_cache
    print("====================================================")
    print("🚀 부엉이_정리됨 고도화된 아카이브 정비 엔진 가동")
    print("====================================================")

    if not os.path.exists(ROOT_DIR):
        print(f"[오류] 대상 아카이브 루트가 존재하지 않습니다: {ROOT_DIR}")
        sys.exit(1)

    load_search_cache()

    all_files_info = []
    for root, _, files in os.walk(ROOT_DIR):
        for file in files:
            if file == ".search_cache.json" or file == "desktop.ini":
                continue
            filepath = os.path.join(root, file)
            all_files_info.append((filepath, file))

    print(f"📦 아카이브 루트: {ROOT_DIR}")
    print(f"📄 스캔된 전체 파일 수: {len(all_files_info)}개\n")

    archived_count = 0
    renamed_count = 0

    # 1. Sort files by depth (descending) to process structured files first
    all_files_info.sort(key=lambda x: x[0].replace('/', '\\').count('\\'), reverse=True)

    # Pass 1: Scan & Collect Metadata
    file_records = []
    for filepath, file in all_files_info:
        if not os.path.exists(filepath):
            continue

        abs_orig_path = os.path.abspath(filepath)
        
        # Strip any existing '[최종] ' prefix from filename
        clean_name, had_final_tag = clean_final_tag(file)

        has_prefix = re.match(r"^202\d{5}_", clean_name) is not None
        inferred_date, content, hash_val = get_inferred_date_and_content(filepath, clean_name)
        year_str = inferred_date[:4]

        # 1차 테마 판별
        target_theme = get_theme_folder(clean_name, content)
        
        # 3차 업무 판별
        target_work = get_work_domain(clean_name, content)

        # 파일명 표준화 및 접두사 복원
        std_name = clean_name
        if not has_prefix:
            std_name = re.sub(r"^[#★\s\*]+", "", clean_name)
            std_name = f"{inferred_date}_{std_name}"
            renamed_count += 1
        else:
            std_name = re.sub(r"^[#★\s\*]+", "", clean_name)

        # 요약 추가
        name_no_ext = os.path.splitext(std_name)[0]
        if content and not re.search(r"\([^)]+\)$", name_no_ext):
            ai_summary = get_ai_content_summary(std_name, content, target_work)
            if not ai_summary:
                ai_summary = get_local_content_summary(std_name, content, target_work)
            if ai_summary:
                name_part, ext_part = os.path.splitext(std_name)
                std_name = f"{name_part}({ai_summary}){ext_part}"

        # 최종 이관 디렉토리 구성 (테마별 세부 계층화 반영)
        if target_theme == "01_강남_AI_메디헬스_센터":
            sub_theme = "01-2_헬스체크업"
            if re.search(r"01-1[\s_\-]", std_name) or re.search(r"\[01-1\]", std_name):
                sub_theme = "01-1_서울체력장"
            elif re.search(r"01-2[\s_\-]", std_name) or re.search(r"\[01-2\]", std_name):
                sub_theme = "01-2_헬스체크업"
            else:
                gym_keywords = ["체력장", "체력인증", "체력측정", "체력인증센터", "국민체력", "체력왕"]
                for kw in gym_keywords:
                    if kw in std_name or (content and kw in content):
                        sub_theme = "01-1_서울체력장"
                        break
            dest_dir = os.path.join(ROOT_DIR, target_theme, sub_theme, f"{year_str}년", target_work)
        else:
            dest_dir = os.path.join(ROOT_DIR, target_theme, f"{year_str}년", target_work)

        try:
            stat = os.stat(filepath)
            size = stat.st_size
            mtime = stat.st_mtime
        except Exception:
            size = 0
            mtime = 0

        file_records.append({
            "orig_path": abs_orig_path,
            "orig_filename": file,
            "clean_name": clean_name,
            "std_name": std_name,
            "had_final_tag": had_final_tag,
            "content": content,
            "hash_val": hash_val,
            "size": size,
            "mtime": mtime,
            "dest_dir": os.path.abspath(dest_dir)
        })

    # Group records by dest_dir
    files_by_dest = {}
    for r in file_records:
        d = r["dest_dir"]
        if d not in files_by_dest:
            files_by_dest[d] = []
        files_by_dest[d].append(r)

    # Pass 2: Clustering and Resolution
    for dest_dir, files_in_dir in files_by_dest.items():
        N = len(files_in_dir)
        if N == 0:
            continue
        
        # Build similarity graph
        adj = {i: [] for i in range(N)}
        for i in range(N):
            for j in range(i + 1, N):
                info_i = files_in_dir[i]
                info_j = files_in_dir[j]
                is_dup = False
                
                is_empty_i = info_i["size"] == 0
                is_empty_j = info_j["size"] == 0
                
                # Exclude 0-byte (empty) files from Tier 1-4 comparison.
                # Empty files are duplicates only if extensions and cleaned base names match exactly.
                if is_empty_i or is_empty_j:
                    if is_empty_i and is_empty_j:
                        ext_i = os.path.splitext(info_i["std_name"])[1].lower()
                        ext_j = os.path.splitext(info_j["std_name"])[1].lower()
                        clean_i = get_clean_base_filename(info_i["std_name"]).lower()
                        clean_j = get_clean_base_filename(info_j["std_name"]).lower()
                        if ext_i == ext_j and clean_i == clean_j:
                            is_dup = True
                        else:
                            is_dup = False
                    else:
                        is_dup = False
                # Tier 1: SHA-256 hash equality (for non-empty files)
                elif info_i["hash_val"] and info_j["hash_val"] and info_i["hash_val"] == info_j["hash_val"]:
                    is_dup = True
                # Tier 2: Text content cosine similarity >= 80%
                elif info_i["content"] and info_j["content"] and calculate_cosine_similarity(info_i["content"], info_j["content"]) >= 0.80:
                    is_dup = True
                # Tier 3: Text content cosine similarity >= 50% AND SequenceMatcher filename similarity >= 80%
                elif info_i["content"] and info_j["content"] and calculate_cosine_similarity(info_i["content"], info_j["content"]) >= 0.50 and get_filename_similarity(info_i["std_name"], info_j["std_name"]) >= 0.80:
                    is_dup = True
                # Tier 4: SequenceMatcher filename similarity >= 80% AND size difference <= 5% (for non-text/binary files)
                # But for binary files (size > 0), only duplicate if hashes match or base names match exactly.
                elif (not info_i["content"] or not info_j["content"]):
                    if info_i["hash_val"] == info_j["hash_val"]:
                        is_dup = True
                    else:
                        clean_i = get_clean_base_filename(info_i["std_name"]).lower()
                        clean_j = get_clean_base_filename(info_j["std_name"]).lower()
                        if clean_i == clean_j:
                            max_size = max(info_i["size"], info_j["size"])
                            size_diff_ratio = abs(info_i["size"] - info_j["size"]) / max_size if max_size > 0 else 0.0
                            if size_diff_ratio <= 0.05:
                                is_dup = True
                        
                if is_dup:
                    adj[i].append(j)
                    adj[j].append(i)

        # Connected Components
        visited = [False] * N
        components = []
        for i in range(N):
            if not visited[i]:
                comp = []
                queue = [i]
                visited[i] = True
                while queue:
                    node = queue.pop(0)
                    comp.append(node)
                    for neighbor in adj[node]:
                        if not visited[neighbor]:
                            visited[neighbor] = True
                            queue.append(neighbor)
                components.append(comp)

        # Process each component
        for comp in components:
            if len(comp) == 1:
                # Unique file
                info = files_in_dir[comp[0]]
                os.makedirs(dest_dir, exist_ok=True)
                final_filename = resolve_filename_collision(dest_dir, info["std_name"], info["orig_path"])
                dest_path = os.path.join(dest_dir, final_filename)
                
                if info["orig_path"] != dest_path:
                    try:
                        shutil.move(info["orig_path"], dest_path)
                        print(f"📦 이관 완료: {os.path.relpath(dest_path, ROOT_DIR)}")
                        archived_count += 1
                        sync_cache_move(info["orig_path"], dest_path, info)
                    except Exception as e:
                        print(f"[오류] 파일 이관 실패 ({info['std_name']}): {e}")
                else:
                    sync_cache_move(info["orig_path"], dest_path, info)
            else:
                # Duplicate cluster
                # Rank: (has_final_keyword, mtime)
                ranked_nodes = sorted(
                    comp,
                    key=lambda idx: (
                        has_final_keyword(files_in_dir[idx]["orig_filename"], files_in_dir[idx]["had_final_tag"]),
                        files_in_dir[idx]["mtime"]
                    ),
                    reverse=True
                )
                final_index = ranked_nodes[0]
                dup_indices = ranked_nodes[1:]
                
                final_info = files_in_dir[final_index]
                
                # Move duplicates first to dest_dir/_Duplicates
                dup_dir = os.path.join(dest_dir, "_Duplicates")
                os.makedirs(dup_dir, exist_ok=True)
                
                for idx in dup_indices:
                    dup_info = files_in_dir[idx]
                    proposed_dup_name = dup_info["std_name"]
                    resolved_dup_name = resolve_filename_collision(dup_dir, proposed_dup_name, dup_info["orig_path"])
                    dup_dest_path = os.path.join(dup_dir, resolved_dup_name)
                    
                    print(f"⚠️  중복 파일 발견: '{dup_info['orig_filename']}' -> '{final_info['orig_filename']}' (moved to _Duplicates)")
                    
                    if dup_info["orig_path"] != dup_dest_path:
                        try:
                            shutil.move(dup_info["orig_path"], dup_dest_path)
                            print(f"📦 이관 완료: {os.path.relpath(dup_dest_path, ROOT_DIR)}")
                            archived_count += 1
                            sync_cache_move(dup_info["orig_path"], dup_dest_path, dup_info)
                        except Exception as e:
                            print(f"[오류] 중복 파일 이관 실패 ({proposed_dup_name}): {e}")
                    else:
                        sync_cache_move(dup_info["orig_path"], dup_dest_path, dup_info)

                # Move/Rename final file in dest_dir
                os.makedirs(dest_dir, exist_ok=True)
                clean_base = get_clean_base_filename(final_info["std_name"])
                keywords = extract_korean_keywords(final_info["content"])
                base_name, ext = os.path.splitext(clean_base)
                if keywords:
                    proposed_final_name = "★최종★_" + base_name + "_(" + ", ".join(keywords) + ")" + ext
                else:
                    proposed_final_name = "★최종★_" + clean_base
                resolved_final_name = resolve_filename_collision(dest_dir, proposed_final_name, final_info["orig_path"])
                final_dest_path = os.path.join(dest_dir, resolved_final_name)
                
                if final_info["orig_path"] != final_dest_path:
                    try:
                        shutil.move(final_info["orig_path"], final_dest_path)
                        print(f"📦 이관 완료 (최종): {os.path.relpath(final_dest_path, ROOT_DIR)}")
                        archived_count += 1
                        sync_cache_move(final_info["orig_path"], final_dest_path, final_info)
                    except Exception as e:
                        print(f"[오류] 최종 파일 이관 실패 ({proposed_final_name}): {e}")
                else:
                    sync_cache_move(final_info["orig_path"], final_dest_path, final_info)

    # Prune stale paths from cache
    stale_keys = [k for k in global_cache.keys() if not os.path.exists(k)]
    for k in stale_keys:
        global_cache.pop(k, None)
    save_search_cache()

    print("\n🧹 비어 있는 껍데기 폴더 정리 중...")
    clean_empty_folders(ROOT_DIR)

    print("\n====================================================")
    print("🎉 아카이브 정비 리포트 완료")
    print("====================================================")
    print(f"1. 표준 네이밍(`YYYYMMDD_`) 신규 부여/조정 파일 수: {renamed_count}개")
    print(f"2. 전체 아카이브(`2021~2026년`) 최종 이관 파일 수: {archived_count}개")
    print(f"🎉 3단 계층 구조 배치가 완료되었습니다.")
    print("====================================================")

if __name__ == "__main__":
    main()
