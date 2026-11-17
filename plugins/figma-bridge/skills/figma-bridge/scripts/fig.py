#!/usr/bin/env python3
"""Run a JavaScript snippet inside a Figma file through the Claude Bridge plugin.

  fig.py --status                                  who is connected (file names) and what is queued
  fig.py SCRIPT.js --file "File name" [options]    run SCRIPT.js in that file

Options:
  --file NAME      target Figma file (exact name as shown in Figma). The job is routed only to a plugin window
                   open in that file, and the script also refuses to run anywhere else. Strongly recommended.
  --lib            prepend scripts/lib.js (helpers: dump, png, paintVar, txt, setText, variantOf, setProp ...)
  --arg k=v        values available in the script as ARGS.k (repeatable; numbers and true/false are parsed)
  --out DIR        where to write <name>.json and images (default: $FIGMA_BRIDGE_HOME/out)
  --name NAME      base name for the result file (default: script file name)
  --max N          print at most N characters of the result (default 6000; 0 = print nothing)
  --timeout S      seconds to wait for the plugin (default 600)

Script contract (the body of an async function with `figma` in scope):
  return { j: J(anyJsonValue), png_<name>: base64Png, jpg_<name>: base64Jpg }
  - J() escapes non-ASCII, so Cyrillic and other text arrive intact; the runner decodes it.
  - png_/jpg_ keys are written to files in --out and removed from the printed result.
  - throw or return { __error: '...' } to fail; the runner exits with code 1 and prints the message.

Environment: FIGMA_BRIDGE_HOME (default ~/.figma-bridge), FIGMA_BRIDGE_PORT (default 7787).
"""
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
HOME = os.path.expanduser(os.environ.get('FIGMA_BRIDGE_HOME', '~/.figma-bridge'))
PORT = int(os.environ.get('FIGMA_BRIDGE_PORT', '7787'))
BASE = 'http://127.0.0.1:%d' % PORT
BS = chr(92)


def die(msg, code=1):
    print(msg, file=sys.stderr)
    sys.exit(code)


def ascii_js(s):
    """Escape every non-ASCII character as \\uXXXX (surrogate pairs above the BMP)."""
    out = []
    for ch in s:
        o = ord(ch)
        if o < 128:
            out.append(ch)
        elif o <= 0xFFFF:
            out.append(BS + 'u%04x' % o)
        else:
            o -= 0x10000
            out.append(BS + 'u%04x' % (0xD800 + (o >> 10)) + BS + 'u%04x' % (0xDC00 + (o & 0x3FF)))
    return ''.join(out)


def parse_args(argv):
    opts = {'file': None, 'lib': False, 'args': {}, 'out': os.path.join(HOME, 'out'), 'name': None,
            'max': 6000, 'timeout': 600, 'status': False, 'script': None}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == '--status':
            opts['status'] = True
        elif a == '--lib':
            opts['lib'] = True
        elif a in ('--file', '--out', '--name', '--max', '--timeout', '--arg'):
            if i + 1 >= len(argv):
                die('missing value for ' + a)
            v = argv[i + 1]
            i += 1
            if a == '--arg':
                if '=' not in v:
                    die('--arg expects key=value')
                k, val = v.split('=', 1)
                if val in ('true', 'false'):
                    val = val == 'true'
                else:
                    try:
                        val = int(val)
                    except ValueError:
                        try:
                            val = float(val)
                        except ValueError:
                            pass
                opts['args'][k] = val
            elif a in ('--max', '--timeout'):
                opts[a[2:]] = int(v)
            else:
                opts[a[2:]] = v
        elif a in ('-h', '--help'):
            print(__doc__)
            sys.exit(0)
        elif opts['script'] is None:
            opts['script'] = a
        else:
            die('unexpected argument: ' + a)
        i += 1
    return opts


def get_json(path):
    with urllib.request.urlopen(BASE + path, timeout=5) as r:
        return json.loads(r.read())


def status():
    try:
        s = get_json('/status')
    except Exception as e:
        die('bridge server is not answering on port %d (%s). Start it: node %s/server.js' % (PORT, e, HOME))
    if not s.get('clients'):
        print('server is up, but no plugin is polling. In Figma: Plugins > Development > Claude Bridge (in the target file).')
    for c in s.get('clients', []):
        print('connected: %s (last poll %.1f s ago)' % (c['file'], c['lastPollMs'] / 1000))
    if s.get('queued'):
        print('queued jobs for: ' + ', '.join(s['queued']))
    return s


def build_code(opts, body):
    pre = []
    pre.append('const ARGS = ' + json.dumps(opts['args'], ensure_ascii=False) + ';')
    pre.append("const __A = s => { let o = ''; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); "
               "o += c > 127 ? '" + BS + BS + "u' + ('0000' + c.toString(16)).slice(-4) : s[i]; } return o; };")
    pre.append('const J = o => __A(JSON.stringify(o));')
    if opts['file']:
        # synchronous check first: a stale plugin window answers sync calls even when async API calls fail
        pre.append('const FILE = ' + json.dumps(opts['file'], ensure_ascii=False) + ';')
        pre.append('if (figma.root.name !== FILE) return { __wrongfile: figma.root.name };')
    if opts['lib']:
        with open(os.path.join(HERE, 'lib.js'), encoding='utf-8') as f:
            pre.append(f.read())
    src = '\n'.join(pre) + '\n' + body
    code = 'try {\n' + src + '\n} catch (e) { return { __error: String(e && e.message || e), stack: String(e && e.stack || "") }; }'
    code = ascii_js(code)
    assert all(ord(ch) < 128 for ch in code)
    return code


def post(code, opts):
    tok_path = os.path.join(HOME, '.token')
    if not os.path.exists(tok_path):
        die('no token at %s — start the bridge server first (node %s/server.js)' % (tok_path, HOME))
    token = open(tok_path).read().strip()
    headers = {'x-token': token, 'content-type': 'text/plain; charset=utf-8'}
    if opts['file']:
        headers['x-file'] = urllib.parse.quote(opts['file'], safe='')
    req = urllib.request.Request(BASE + '/run', data=code.encode('ascii'), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=opts['timeout'] + 5) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', 'replace')
        die('bridge HTTP %d: %s' % (e.code, body[:500]))
    except urllib.error.URLError as e:
        die('bridge server is not answering on port %d (%s)' % (PORT, e))


def main():
    opts = parse_args(sys.argv[1:])
    if opts['status']:
        status()
        return
    if not opts['script']:
        die(__doc__, 2)
    with open(opts['script'], encoding='utf-8') as f:
        body = f.read()
    code = build_code(opts, body)
    name = opts['name'] or os.path.splitext(os.path.basename(opts['script']))[0]

    for attempt in range(6):
        d = post(code, opts)
        r = d.get('result')
        if isinstance(r, dict) and '__wrongfile' in r:
            # only happens with an old plugin that does not report its file; wait for the right window
            print('job went to file "%s", retrying…' % r['__wrongfile'], file=sys.stderr)
            time.sleep(1.5)
            continue
        break
    else:
        die('the job kept landing in another file. Close the bridge plugin there, or open it in "%s".' % opts['file'])

    if not d.get('ok'):
        die('FAIL ' + (d.get('error') or '') + ('\n' + d['stack'][:1500] if d.get('stack') else ''))
    if isinstance(r, dict) and '__error' in r:
        die('ERR ' + r['__error'] + ('\n' + r.get('stack', '')[:1500] if r.get('stack') else ''))

    os.makedirs(opts['out'], exist_ok=True)
    saved = []
    if isinstance(r, dict):
        for k in list(r):
            if k.startswith('png_') or k.startswith('jpg_'):
                fn = os.path.join(opts['out'], k[4:] + '.' + k[:3])
                with open(fn, 'wb') as f:
                    f.write(base64.b64decode(r[k]))
                saved.append(fn)
                del r[k]
        if isinstance(r.get('j'), str):
            try:
                r['j'] = json.loads(r['j'])
            except ValueError:
                pass
    out_json = os.path.join(opts['out'], name + '.json')
    with open(out_json, 'w', encoding='utf-8') as f:
        json.dump(r, f, ensure_ascii=False, indent=1)

    print('ok %s ms · result: %s' % (d.get('ms'), out_json))
    for fn in saved:
        print('image: ' + fn)
    if opts['max']:
        shown = r.get('j', r) if isinstance(r, dict) else r
        text = shown if isinstance(shown, str) else json.dumps(shown, ensure_ascii=False, indent=1)
        print(text[:opts['max']] + ('\n… (truncated, full result in the json file)' if len(text) > opts['max'] else ''))


if __name__ == '__main__':
    main()
