# PLAN 8.3 규칙만으로 부록 A 40개가 통과하는지 확인한 참고 구현 (명세 검증용).
# 그대로 옮기지 말 것: TS로 새로 쓰고, 부록 A를 Vitest로 옮겨 기준으로 삼는다.
# 실행: python3 parser_prototype.py
import re, unicodedata

COUNT_WORDS = r'(?:개입|개묶음|개|입|팩|봉지|봉|캔|병|롤|구|포|t|ea|p|세트|박스|통)'
GIFT = re.compile(r'증정|사은품|덤')
MIX_KW = re.compile(r'택\s*1|골라|옵션|선택')

def norm(s):
    s = unicodedata.normalize('NFKC', s).lower()
    s = re.sub(r'[×＊]', '*', s)
    s = re.sub(r'\[[^\]]*\]|【[^】]*】', ' ', s)          # 대괄호 머리말
    s = re.sub(r'x(?=\s*\d)', '*', s)                       # 곱셈 x → *
    return re.sub(r'\s+', ' ', s).strip()

def amounts(s, has_roll):
    # 숫자 바로 뒤에 단위가 붙어야 하므로 '46cm' '3겹' 'f3'은 용량으로 잡히지 않는다
    out = []
    for m in re.finditer(r'(\d+(?:\.\d+)?)\s*(ml|리터|kg|키로|그램|l|g|매|m)(?![a-wyz])', s):
        v, u = float(m.group(1)), m.group(2)
        if u == 'm':
            if not has_roll: continue          # m는 '롤'이 있는 제목에서만 롤당 길이
            out.append((v, 'm', m.span()))
        elif u in ('ml',): out.append((v, 'ml', m.span()))
        elif u in ('l', '리터'): out.append((v*1000, 'ml', m.span()))
        elif u in ('g', '그램'): out.append((v, 'g', m.span()))
        elif u in ('kg', '키로'): out.append((v*1000, 'g', m.span()))
        elif u == '매': out.append((v, 'sheet', m.span()))
    return out

def blank(s, spans):
    s = list(s)
    for a, b in spans:
        for i in range(a, b): s[i] = ' '
    return ''.join(s)

def counts(s):
    vals = [int(m.group(1)) for m in re.finditer(r'\*?\s*(\d+)\s*' + COUNT_WORDS + r'(?![a-z])', s)]
    s2 = re.sub(r'\*?\s*(\d+)\s*' + COUNT_WORDS + r'(?![a-z])', ' ', s)
    vals += [int(m.group(1)) for m in re.finditer(r'\*\s*(\d+)', s2)]
    return vals

def parse_group(g, has_roll):
    amts = amounts(g, has_roll)
    g2 = blank(g, [a[2] for a in amts])
    c = counts(g2)
    prod = 1
    for v in c: prod *= v
    return amts, (prod if c else None)

def parse(title):
    s = norm(title)
    has_gift = False
    # 증정 분리: '+'로 나눈 조각 중 증정어가 있는 조각 제거, '+' 없이 '증정'이 있으면 그 뒤를 자름
    parts = re.split(r'\+(?!\s*\d+(?!\s*(?:ml|l|g|kg|m|매|\.)))', s)  # N+M의 '+'는 나누지 않음
    keep = []
    for p in parts:
        if GIFT.search(p): has_gift = True; continue
        keep.append(p)
    # N+M 행사
    promo = 1
    joined = ' + '.join(keep)
    def promo_sub(m):
        nonlocal promo; promo *= int(m.group(1)) + int(m.group(2)); return ' '
    joined = re.sub(r'(?<![\d.])(\d+)\s*\+\s*(\d+)(?!\s*(?:ml|l|g|kg|매|\.|\d))', promo_sub, joined)
    mixed = bool(MIX_KW.search(joined))
    has_roll = '롤' in joined
    # 괄호 분류
    rests = []
    first_amt = re.search(r'\d+(?:\.\d+)?\s*(?:ml|리터|kg|키로|그램|l|g|매|m)(?![a-wyz])', joined)
    def paren(m):
        inner, end = m.group(1), m.end()
        followed_mult = re.match(r'\s*\*\s*\d', joined[end:])
        leading = first_amt is None or m.start() < first_amt.start()
        if followed_mult or leading: return ' ' + inner + ' '
        rests.append(inner); return ' '
    joined = re.sub(r'\(([^()]*)\)', paren, joined)
    groups = [g for g in joined.split('+') if g.strip()]
    parsed = [parse_group(g, has_roll) for g in groups]
    all_amts = [a for amts, _ in parsed for a in amts]
    distinct = {(round(a[0], 3), a[1]) for a in all_amts}
    if len(distinct) > 1: mixed = True
    if mixed:
        return dict(amount=None, unit=None, count=None, gift=has_gift, mixed=True, conf='low')
    amount, unit = (all_amts[0][0], all_amts[0][1]) if all_amts else (None, None)
    explicit = [c for _, c in parsed if c is not None]
    if len(parsed) > 1:      # 같은 용량 묶음 연결 → 개수 더함
        count = sum(c if c is not None else 1 for _, c in parsed)
    else:
        count = explicit[0] if explicit else None
    conf = 'high'
    for r in rests:
        ramts, rc = parse_group(r, has_roll)
        if rc is not None:
            if count is None: count = rc
            elif rc != count: conf = 'low'
        elif ramts and amount and count:
            if abs(ramts[0][0] - amount * count) > amount * count * 0.01: conf = 'low'
    if count is None and amount is not None: count = 1
    if count is not None: count *= promo
    elif promo > 1: count = promo
    return dict(amount=amount, unit=unit, count=count, gift=has_gift, mixed=False, conf=conf)

M = 'mixed'
cases = [
 ('다우니 섬유유연제 실내건조 2.6L', 2600,'ml',1), ('다우니 실내건조 섬유유연제 2.6L x 2개', 2600,'ml',2),
 ('다우니 섬유유연제 실내건조 2.6Lx3', 2600,'ml',3), ('다우니 2.6L*4입 1박스', 2600,'ml',4),
 ('[본사직영] 다우니 실내건조 2.6L 2개 + 증정 1L', 2600,'ml',2), ('다우니 섬유유연제 리필 1.6L / 2.6L 택1', M,M,M),
 ('코디 3겹 데코 화장지 30m 30롤', 30,'m',30), ('코디 데코 3겹 30m 30롤 x 2팩', 30,'m',60),
 ('[무료배송] 깨끗한나라 순수 3겹 30m 30롤 2팩 + 미용티슈 증정', 30,'m',60), ('농심 신라면 120g 5개입', 120,'g',5),
 ('농심 신라면 멀티팩 (120g x 5) x 4', 120,'g',20), ('오뚜기 진라면 매운맛 120g x 5입 x 8팩 (40개)', 120,'g',40),
 ('(10개묶음) 신라면 120g', 120,'g',10), ('농심 신라면 40봉 1박스', None,None,40),
 ('햇반 210g x 24개', 210,'g',24), ('CJ 햇반 210g 12개 + 210g 12개 (총 24개)', 210,'g',24),
 ('제주삼다수 2L x 6병', 2000,'ml',6), ('제주삼다수 2L 12병 (6병x2팩)', 2000,'ml',12),
 ('동원참치 라이트스탠다드 150g 10캔', 150,'g',10), ('동원참치 135g*8캔', 135,'g',8),
 ('맥심 모카골드 마일드 커피믹스 180T', None,None,180), ('맥심 모카골드 12g x 180개입', 12,'g',180),
 ('크리넥스 마이비데 물티슈 캡형 70매 x 10팩', 70,'sheet',10), ('베베숲 물티슈 오리지널 100매 10팩 (총 1000매)', 100,'sheet',10),
 ('페리오 46cm 치약 100g 3개입', 100,'g',3), ('샘표 진간장 금F3 1.7L', 1700,'ml',1),
 ('1+1 해피홈 에어로솔 500ml', 500,'ml',2), ('아이깨끗해 핸드워시 리필 450ml 3+1', 450,'ml',4),
 ('피죤 섬유유연제 3100ml', 3100,'ml',1), ('피죤 3.1L 2개입 (총 6.2L)', 3100,'ml',2),
 ('스파크 세제 2kg', 2000,'g',1), ('칠성사이다 500ml x 20개', 500,'ml',20),
 ('코카콜라 제로 355ml 24캔', 355,'ml',24), ('코카콜라 제로 190ml x 30캔 / 355ml x 24캔 골라담기', M,M,M),
 ('CJ 스팸 클래식 200g x 10개 + 340g 2개', M,M,M), ('농심 새우깡 90g x 20봉', 90,'g',20),
 ('1.8L 3개 x 2세트', 1800,'ml',6), ('비트 액체세제 3L 일반드럼겸용 리필 1.8L x 2', M,M,M),
 ('다우니 섬유유연제 실내건조 2.6L (2.6L x 1개)', 2600,'ml',1), ('해피홈 물티슈 100매 x 10팩 x 2박스', 100,'sheet',20),
]
fail = 0
for i, (t, a, u, c) in enumerate(cases, 1):
    r = parse(t)
    ok = r['mixed'] if a == M else (not r['mixed'] and r['amount'] == a and r['unit'] == u and r['count'] == c)
    if not ok: fail += 1
    print(f"{'OK ' if ok else 'XX '}{i:2d} {t[:40]:40s} -> {r}")
print('FAIL', fail)
