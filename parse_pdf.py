import fitz
import itertools

doc = fitz.open(r'd:\Desktop\report 2.pdf')
text = []
for page in doc:
    words = page.get_text('words')
    # sort by vertical line (rounded by 10) then horizontal position
    words.sort(key=lambda w: (round(w[3]/5), w[0]))
    for k, g in itertools.groupby(words, key=lambda w: round(w[3]/5)):
        text.append(' '.join(w[4] for w in sorted(g, key=lambda w: w[0])))

with open('parsed_report2_sorted.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(text))
