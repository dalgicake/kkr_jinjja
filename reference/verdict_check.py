# PLAN 9장 판정 규칙의 참고 구현 + 부록 D 13개 케이스 산수 확인 (명세 검증용).
# 실행: python3 verdict_check.py
UNIT_BASE = {'ml':100,'g':100,'m':10,'sheet':100,'ea':1}
CLOSE, MARGIN = 3000, 0.03

def unit_price(price, amt, cnt, unit):
    return price / cnt if unit == 'ea' else price / (amt*cnt) * UNIT_BASE[unit]

def decide(t, store_price, promo, applied, cands):
    if store_price is None: return {'type':'NEED_STORE_PRICE'}
    price, count = store_price, t['count']
    if applied and promo:
        n, m = promo; price, count = store_price*n, t['count']*(n+m)
    su = unit_price(price, t['amt'], count, t['unit'])
    exacts = [c for c in cands if c['rel']=='SAME_ITEM' and c['count']==count]
    best = min(exacts, key=lambda c:c['price']) if exacts else None
    bund = [c for c in cands if (c['rel']=='SAME_ITEM' and c['count']!=count) or c['rel']=='SIZE_DIFF']
    for c in bund: c['u'] = unit_price(c['price'], c['amt'], c['count'], t['unit'])
    bb = min(bund, key=lambda c:c['u']) if bund else None
    ins = None
    if bb and bb['u'] < su*(1-MARGIN):
        ins = {'pct': round((1-bb['u']/su)*100), 'count': bb['count'], 'total': bb['price'], 'u': round(bb['u'])}
    r = {'store_unit': round(su,2), 'insight': ins}
    if best:
        d = price - best['price']
        if d < 0: r.update(type='STORE_CHEAPER', diff=-d)
        elif d == 0: r.update(type='SAME_PRICE')
        else: r.update(type='ONLINE_CHEAPER', diff=d, closeCall=d<CLOSE)
    elif bund:
        r.update(type='BUNDLE_ONLY', unitWinner='online' if bb['u'] < su*(1-MARGIN) else 'store', bundle_u=round(bb['u'],2))
    else: r.update(type='NO_MATCH')
    return r

S = lambda amt,cnt,price,rel='SAME_ITEM': {'amt':amt,'count':cnt,'price':price,'rel':rel}
T = lambda amt,cnt,unit='ml': {'amt':amt,'count':cnt,'unit':unit}
cases = {
 1: decide(T(2600,1),9980,None,False,[S(2600,1,8900)]),
 2: decide(T(2600,1),8500,None,False,[S(2600,1,8900)]),
 3: decide(T(2600,1),8900,None,False,[S(2600,1,8900)]),
 4: decide(T(30,30,'m'),15900,None,False,[S(30,60,27800)]),
 5: decide(T(120,5,'g'),4980,None,False,[S(120,5,3900),S(120,40,26000)]),
 6: decide(T(2600,1),9980,None,False,[S(2600,1,5000,'UNCERTAIN')]),
 7: decide(T(2600,1),9980,None,False,[S(2600,1,8900),S(2600,1,5000,'UNCERTAIN')]),
 8: decide(T(2600,1),9980,(1,1),True,[S(2600,1,8900),S(2600,2,16500)]),
 '9a': decide(T(2600,1),11900,None,False,[S(2600,1,8900)]),
 '9b': decide(T(2600,1),11899,None,False,[S(2600,1,8900)]),
 10: decide(T(2600,1),None,None,False,[S(2600,1,8900)]),
 11: decide(T(2600,1),9980,None,False,[S(2600,1,10500),S(2600,2,19580)]),
 12: decide(T(2600,1),9980,None,False,[S(1600,1,7900,'SIZE_DIFF')]),
 13: decide(T(500,1),3000,(2,1),True,[S(500,3,6600)]),
}
for k,v in cases.items(): print(k, v)
