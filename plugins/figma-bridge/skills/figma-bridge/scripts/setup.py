#!/usr/bin/env python3
"""Install / start / check the Claude Figma Bridge.

  setup.py install   copy the Figma plugin and the server to the bridge folder
  setup.py start     install if needed, start the server in the background, wait until it answers
  setup.py check     print server and plugin status
  setup.py open      show the bridge folder in Finder / Explorer (to import the plugin in Figma)

Bridge folder: $FIGMA_BRIDGE_HOME, default ~/Documents/Claude Bridge — a visible folder, so in Figma's
"Import plugin from manifest…" dialog it is Documents → Claude Bridge → manifest.json. Layout:
  Claude Bridge/manifest.json, code.js, ui.html   the Figma plugin (import manifest.json once)
  Claude Bridge/server/server.js (+ .token, log)  the local server
  Claude Bridge/out/                              results and images of scripts
"""
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.normpath(os.path.join(HERE, '..', 'bridge'))
HOME = os.path.expanduser(os.environ.get('FIGMA_BRIDGE_HOME', os.path.join('~', 'Documents', 'Claude Bridge')))
SERVER_DIR = os.path.join(HOME, 'server')
PORT = int(os.environ.get('FIGMA_BRIDGE_PORT', '7787'))
MANIFEST = os.path.join(HOME, 'manifest.json')


def install():
    os.makedirs(SERVER_DIR, exist_ok=True)
    os.makedirs(os.path.join(HOME, 'out'), exist_ok=True)
    for name in ['manifest.json', 'code.js', 'ui.html']:
        shutil.copy2(os.path.join(SRC, 'plugin', name), os.path.join(HOME, name))
    shutil.copy2(os.path.join(SRC, 'server.js'), os.path.join(SERVER_DIR, 'server.js'))
    print('bridge installed: ' + HOME)
    print('Figma (desktop app): Plugins → Development → Import plugin from manifest… → ' + MANIFEST)


def status():
    try:
        with urllib.request.urlopen('http://127.0.0.1:%d/status' % PORT, timeout=3) as r:
            return json.loads(r.read())
    except Exception:
        return None


def start():
    if not os.path.exists(os.path.join(SERVER_DIR, 'server.js')):
        install()
    if status() is not None:
        print('server already running on port %d' % PORT)
        return
    if shutil.which('node') is None:
        sys.exit('Node.js is required (https://nodejs.org, LTS) — `node` was not found')
    log = open(os.path.join(SERVER_DIR, 'server.log'), 'a')
    kwargs = {'stdout': log, 'stderr': log, 'stdin': subprocess.DEVNULL, 'cwd': SERVER_DIR}
    if os.name == 'nt':
        kwargs['creationflags'] = 0x00000008 | 0x00000200   # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
    else:
        kwargs['start_new_session'] = True
    subprocess.Popen(['node', os.path.join(SERVER_DIR, 'server.js')], **kwargs)
    for _ in range(40):
        time.sleep(0.25)
        if status() is not None:
            print('server started on port %d' % PORT)
            return
    sys.exit('server did not start — see ' + os.path.join(SERVER_DIR, 'server.log'))


def check():
    s = status()
    if s is None:
        print('server: not running (python3 "%s" start)' % os.path.join(HERE, 'setup.py'))
        return
    print('server: running on port %d' % PORT)
    if not s.get('clients'):
        print('plugin: not connected — in Figma run Plugins → Development → Claude Bridge inside the file to edit')
        if not os.path.exists(MANIFEST):
            print('(plugin files missing — run: setup.py install)')
    for c in s.get('clients', []):
        print('plugin: connected in "%s" (last poll %.1f s ago)' % (c['file'], c['lastPollMs'] / 1000))


def reveal():
    target = MANIFEST if os.path.exists(MANIFEST) else HOME
    if sys.platform == 'darwin':
        subprocess.run(['open', '-R', target])
    elif os.name == 'nt':
        subprocess.run(['explorer', '/select,', target])
    else:
        subprocess.run(['xdg-open', HOME])
    print('opened: ' + target)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'check'
    actions = {'install': install, 'start': start, 'check': check, 'open': reveal}
    if cmd not in actions:
        sys.exit(__doc__)
    actions[cmd]()
