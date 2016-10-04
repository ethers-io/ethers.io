#!/usr/local/bin/python3

python = 3
try:
    xrange
    python = 2
except:
    pass

if python == 2:
    raise Exception("Use python3")

import base64
import codecs
import hashlib
import os
import re
import subprocess

reScript = re.compile('<script(?:[^>]+)src="([^"]*)"(?:[^>]*)>((?:.|\n)*?)</script>')
reStyle = re.compile('<link(?:[^>]+)href="([^"]*)"(?:[^>]*)/(?:[^>]*)>')
reJpg = re.compile('url\\(([^)]+.jpg)\\)')
rePng = re.compile('url\\(([^)]+.png)\\)')
reGif = re.compile('url\\(([^)]+.gif)\\)')
reWoff = re.compile('url\\(([^)]+.woff)\\)')

def inlinify_script(match):

    if match.group(2).strip() != '': raise Exception('script has body')
    filename = match.group(1)

    if filename.find('.min.') >= 0:
        script = open('.' + filename, 'rb').read().decode('utf8')
    else:
        script = subprocess.check_output(['uglifyjs', '.' + filename]).decode('utf8')
        if filename == '/scripts/index.js':
            undebug = script.replace('DEBUG=true;', 'DEBUG=false;')
            print(len(undebug), len(script))
            if len(undebug) != len(script) + 1: raise Exception('DEBUG conversion error')
            script = undebug

    print("script", filename, len(script))

    return '<script type="text/javascript">/* ' + filename + ' */ ' + script + '</script>'

def inlinify_style(match):

    if match.group(0).find('rel="stylesheet"') == -1 or match.group(0).find('type="text/css"') == -1:
        raise Exception('not a stylesheet')

    style = subprocess.check_output(['uglifycss', '.' + match.group(1)]).decode('utf8')

    style = reWoff.sub(inlinify_woff, style)

    print("style", match.group(1), len(style))

    return '<style type="text/css">/* ' + match.group(1) + ' */ ' + style + '</style>'

def inlinify_png(match):
    png = open('.' + match.group(1), 'rb').read()
    print("png", match.group(1), len(png))
    return 'url(data:image/png;base64,%s)' % base64.b64encode(png).decode('utf8')

def inlinify_jpg(match):
    jpg = open('.' + match.group(1), 'rb').read()
    print("jpg", match.group(1), len(jpg))
    return 'url(data:image/jpeg;base64,%s)' % base64.b64encode(jpg).decode('utf8')

def inlinify_gif(match):
    gif = open('.' + match.group(1), 'rb').read()
    print("gif", match.group(1), len(gif))
    return 'url(data:image/gif;base64,%s)' % base64.b64encode(gif).decode('utf8')

def inlinify_woff(match):
    woff = open('.' + match.group(1), "rb").read()
    print("woff", match.group(1), len(woff))
    return 'url(data:application/x-font-woff;charset=utf-8;base64,%s)' % base64.b64encode(woff).decode('utf8')

html = open('index.html').read()
print("html", "index.html", len(html))

html = reScript.sub(inlinify_script, html)
html = reStyle.sub(inlinify_style, html)
html = rePng.sub(inlinify_png, html)
html = reJpg.sub(inlinify_jpg, html)
html = reGif.sub(inlinify_gif, html)

#html = reDevOnly.sub('PRODUCTION', html);

EthersHashTag = '<ETHERS_HASH>'
data = html.replace(EthersHashTag, '').encode('utf8')
if len(data) + len(EthersHashTag) != len(html.encode('utf8')):
    raise Exception('ETHERS_HASH conversion bug')

ethersHash = hashlib.sha256(data).hexdigest()

data = html.replace(EthersHashTag, ethersHash).encode('utf8');

open('./dist/index.html', 'wb').write(data)
print("hash: " + ethersHash)
print("html", "./dist/index.html", len(data))
