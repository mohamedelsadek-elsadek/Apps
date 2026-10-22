"""Inline tools/safesync.js into an HTML app (idempotent) right before the first <script> tag that is not external, or after a given anchor."""
import sys,re
SS=open('/home/claude/apps/tools/safesync.js',encoding='utf-8').read()
BLOCK='<script>/*SAFESYNC BEGIN*/\n'+SS+'\n/*SAFESYNC END*/</script>\n'
def inject(path,anchor=None):
    s=open(path,encoding='utf-8').read()
    if '/*SAFESYNC BEGIN*/' in s:
        s=re.sub(r'<script>/\*SAFESYNC BEGIN\*/.*?/\*SAFESYNC END\*/</script>\n',lambda m:BLOCK,s,flags=re.S)
    else:
        if anchor:
            i=s.index(anchor)+len(anchor); s=s[:i]+'\n'+BLOCK+s[i:]
        else:
            i=s.index('</head>'); s=s[:i]+BLOCK+s[i:]
    open(path,'w',encoding='utf-8').write(s)
if __name__=='__main__':
    inject(sys.argv[1], sys.argv[2] if len(sys.argv)>2 else None)
