import pdfplumber, json, re, sys
p=pdfplumber.open(sys.argv[1])
SECT={'Scuola del Fuoco':('incantesimo','Fuoco'),'Scuola dell’Acqua':('incantesimo','Acqua'),'Scuola della Terra':('incantesimo','Terra'),
 'Scuola dell’Aria':('incantesimo','Aria'),'Incantesimi di sintesi':('incantesimo','Sintesi'),'Miracoli del Pantheon della Madre':('miracolo','Madre'),
 'Miracoli del Pantheon del Padre':('miracolo','Padre'),'Miracoli del Pantheon della Spada':('miracolo','Spada'),'Miracoli Generici':('miracolo','Generico')}
KEYMAP={'formula':'formula','aggiunta':'aggiunta','descrizione':'descrizione','gittata':'gittata','bersaglio':'bersaglio','lancio':'lancio','durata':'durata'}
entries=[]; cur_sec=None; pending_text=[]
def flush_text_to_entry(text_lines):
    global cur_sec
    lines=[l.strip() for l in text_lines if l.strip()]
    # detect section headers, drop intros
    out=[]
    for l in lines:
        if l in SECT: cur_sec=SECT[l]; out=[]; continue
        if l.startswith('DISPENSE') or re.match(r'^\d+$',l): continue
        out.append(l)
    return out
carry=[]
for pg in p.pages:
    tables=pg.find_tables()
    top=0
    for t in tables:
        x0,y0,x1,y1=t.bbox
        txt=pg.crop((0,top,pg.width,y0)).extract_text() or ''
        lines=flush_text_to_entry(carry+txt.split('\n')); carry=[]
        rows=t.extract()
        first=(rows[0][0] or '').lower().split('\n')[0] if rows else ''
        if first!='formula' and entries and not lines:
            target=entries[-1]
        elif first!='formula' and entries and lines and not any(r[0] and r[0].lower().startswith('formula') for r in rows):
            target=entries[-1]
        else:
            # title: find title line = shortest heuristic: last "title-like" block start
            # Text before table: maybe intro paragraphs of section, then title, then flavor.
            # Title = last line without terminal punctuation that is followed by flavor lines
            ti=None
            for i,l in enumerate(lines):
                if len(l)<45 and not l.endswith(('.',',',':',';')) and not l[0].islower(): ti=i
            # choose the last title-like line that still has flavor after it or is last
            # prefer a line that's followed by flavor (a sentence)
            cands=[i for i,l in enumerate(lines) if len(l)<45 and not re.search(r'[.,:;]$',l) and l[:1].isupper()]
            ti=cands[0] if cands else 0
            # if multiple candidates, take the one after the last sentence-ending line before it? take last candidate whose following lines exist
            if len(cands)>1:
                # intro paragraphs end with '.', the title is the candidate after last line ending with '.' preceding flavor
                best=cands[-1]
                for c in cands:
                    if c==0 or lines[c-1].endswith(('.',')','”',':')): best=c
                ti=best
            title=lines[ti] if lines else '?'
            flavor=' '.join(lines[ti+1:])
            target=dict(nome=title,tipo=cur_sec[0],scuola=cur_sec[1],livello='Minore',flavor=flavor)
            entries.append(target)
        for r in rows:
            if not r or r[0] is None: 
                # continuation of previous value
                if r and len(r)>1 and r[1]:
                    k=target.get('_last');
                    if k: target[k]=(target[k]+' '+r[1]).strip()
                continue
            k=r[0].lower().split('\n')[0].strip()
            k=KEYMAP.get(k)
            v=(r[1] or '').replace('\n',' ').strip() if len(r)>1 else ''
            if k:
                if v in ('\\','/'): v=''
                target[k]=(target.get(k,'')+' '+v).strip(); target['_last']=k
        top=y1
    rest=pg.crop((0,top,pg.width,pg.height)).extract_text() or ''
    carry=carry+rest.split('\n')
for e in entries:
    e.pop('_last',None)
    e['id']=re.sub(r'[^a-z0-9]+','-',(e['tipo'][:3]+' '+e['scuola']+' '+e['nome']).lower().replace('’','')).strip('-')
json.dump(entries,open(sys.argv[2],'w',encoding='utf-8'),ensure_ascii=False,indent=1)
print(len(entries))
for e in entries: print(e['scuola'],'|',e['nome'],'|',e.get('formula','')[:45],'|',e.get('durata','')[:25],'|',e['flavor'][:40])
