"""Rewrites every slide's transition: slide 1 fades in, slides 2+ use Morph (by object), 1.1 s, with a Fade fallback."""
import re, shutil, sys, zipfile
src, out = sys.argv[1], sys.argv[2]
MORPH = ('<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">'
         '<mc:Choice xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main" Requires="p159">'
         '<p:transition spd="slow" xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" p14:dur="1100"><p159:morph option="byObject"/></p:transition>'
         '</mc:Choice><mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>')
FADE = '<p:transition spd="slow"><p:fade/></p:transition>'
tmp = out + '.tmp'
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        data = zin.read(item.filename)
        m = re.fullmatch(r'ppt/slides/slide(\d+)\.xml', item.filename)
        if m:
            x = data.decode('utf8')
            x = re.sub(r'<mc:AlternateContent[^>]*>(?:(?!</mc:AlternateContent>).)*?<p:transition.*?</mc:AlternateContent>', '', x, flags=re.S)
            x = re.sub(r'<p:transition\b.*?(?:/>|</p:transition>)', '', x, flags=re.S)
            trans = FADE if m.group(1) == '1' else MORPH
            # transition goes right after clrMapOvr (before timing), per the slide schema
            if '</p:clrMapOvr>' in x:
                x = x.replace('</p:clrMapOvr>', '</p:clrMapOvr>' + trans, 1)
            else:
                x = x.replace('</p:cSld>', '</p:cSld>' + trans, 1)
            data = x.encode('utf8')
        zout.writestr(item, data)
shutil.move(tmp, out)
print('ok')
