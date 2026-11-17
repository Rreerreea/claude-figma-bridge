#!/usr/bin/env python3
"""Install / start / check the Claude Figma Bridge.

  setup.py install   copy bridge/ (server + Figma plugin) to $FIGMA_BRIDGE_HOME (default ~/.figma-bridge)
  setup.py start     start the server in the background if it is not running, wait until it answers
  setup.py check     print server and plugin status

The Figma plugin is imported once from $FIGMA_BRIDGE_HOME/plugin/manifest.json
(Figma desktop app → Plugins → Development → Import plugin from manifest…). A stable folder outside the skill
directory keeps that import valid when the skill or plugin is updated.
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
HOME = os.path.expanduser(os.environ.get('FIGMA_BRIDGE_HOME', '~/.figma-bridge'))
PORT = int(os.environ.get('FIGMA_BRIDGE_PORT', '7787'))


def install():
    os.makedirs(os.path.join(HOME, 'plugin'), exist_ok=True)
    for rel in ['server.js', 'plugin/manifest.json', 'plugin/code.js', 'plugin/ui.html']:
        shutil.copy2(os.path.join(SRC, rel), os.path.join(HOME, rel))
    print('bridge installed to ' + HOME)
    print('Figma (desktop app): Plugins → Development → Import plugin from manifest… → ' + os.path.join(HOME, 'plugin', 'manifest.json'))


def status():
    try:
        with urllib.request.urlopen('http://127.0.0.1:%d/status' % PORT, timeout=3) as r:
            return json.loads(r.read())
    except Exception:
        return None


def start():
    if not os.path.exists(os.path.join(HOME, 'server.js')):
        install()
    if status() is not None:
        print('server already running on port %d' % PORT)
        return
    if shutil.which('node') is None:
        sys.exit('Node.js is required (https://nodejs.org) — `node` was not found in PATH')
    log = open(os.path.join(HOME, 'server.log'), 'a')
    subprocess.Popen(['node', os.path.join(HOME, 'server.js')], stdout=log, stderr=log, stdin=subprocess.DEVNULL,
                     cwd=HOME, start_new_session=True)
    for _ in range(40):
        time.sleep(0.25)
        if status() is not None:
            print('server started on port %d (log: %s)' % (PORT, os.path.join(HOME, 'server.log')))
            return
    sys.exit('server did not start — see ' + os.path.join(HOME, 'server.log'))


def check():
    s = status()
    if s is None:
        print('server: not running (python3 %s start)' % os.path.join(HERE, 'setup.py'))
        return
    print('server: running on port %d' % PORT)
    if not s.get('clients'):
        print('plugin: not connected — run Plugins → Development → Claude Bridge inside the Figma file')
    for c in s.get('clients', []):
        print('plugin: connected in "%s" (last poll %.1f s ago)' % (c['file'], c['lastPollMs'] / 1000))


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'check'
    {'install': install, 'start': start, 'check': check}.get(cmd, lambda: sys.exit(__doc__))()
