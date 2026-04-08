import re

with open('src/lib/engine/OntologyRenderer.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old_code = '''        // ?묓엺 ?몃뱶 ?먯떇?쇰줈 媛€???ｌ???洹몃━吏€ ?딆쓬
        if (rc.collapsedNodeIds.has(leftNode.id)) continue;'''

new_code = '''        // 양방향 패치: leftNode가 자식일 수 있으므로 삭제. (이미 layoutHidden 옵션이 방어해줌)'''

if old_code in content:
    content = content.replace(old_code, new_code)
    with open('src/lib/engine/OntologyRenderer.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Renderer Fixed.')
else:
    print('Pattern not found. Checking if Korean string matches.')

