import * as assert from 'assert';
import * as vscode from 'vscode';

import { LintServerPool } from '../../server/pool';

function folder(name: string, fsPath: string): vscode.WorkspaceFolder {
  return { name, index: 0, uri: vscode.Uri.file(fsPath) };
}

const APP = folder('app', '/w/app');
const ENGINE = folder('engine', '/w/engine');

// A LintServer stand-in that records the lifecycle calls made on it.
function fakeServer(workingDirectory: string) {
  return {
    workingDirectory,
    rubyServerProcess: null as unknown,
    starts: 0,
    restarts: 0,
    stops: 0,
    async start() {
      this.starts += 1;
      this.rubyServerProcess = {};
      return this.rubyServerProcess;
    },
    async restart() {
      this.restarts += 1;
      return this.rubyServerProcess;
    },
    stop() {
      this.stops += 1;
      this.rubyServerProcess = null;
    },
  };
}

// Builds a pool over `folders`, with an injectable folder-change event: the test
// host opens no workspace, so none of these globals are available for real.
function poolOver(folders: vscode.WorkspaceFolder[]) {
  const created: ReturnType<typeof fakeServer>[] = [];
  const emitter = new vscode.EventEmitter<vscode.WorkspaceFoldersChangeEvent>();

  const pool = new LintServerPool(
    (workspaceFolder) => {
      const server = fakeServer(workspaceFolder.uri.fsPath);
      created.push(server);
      return server as any;
    },
    {
      folders: () => folders,
      folderFor: (uri) => folders.find((candidate) => uri.fsPath.startsWith(candidate.uri.fsPath)),
      onDidChangeFolders: emitter.event,
    }
  );

  return { pool, created, emitter };
}

function documentIn(fsPath: string): vscode.TextDocument {
  return { uri: vscode.Uri.file(fsPath) } as vscode.TextDocument;
}

suite('LintServerPool Tests', () => {
  test('creates one server per workspace folder', () => {
    const { pool, created } = poolOver([APP, ENGINE]);

    try {
      assert.deepStrictEqual(
        created.map((server) => server.workingDirectory),
        ['/w/app', '/w/engine']
      );
    } finally {
      pool.dispose();
    }
  });

  test('serves a document from the server of its own folder', () => {
    const { pool, created } = poolOver([APP, ENGINE]);

    try {
      assert.strictEqual(pool.for(documentIn('/w/engine/app/views/posts/index.html.haml')) as any, created[1]);
      assert.strictEqual(pool.for(documentIn('/w/app/app/views/users/index.html.haml')) as any, created[0]);
    } finally {
      pool.dispose();
    }
  });

  test('has no server for a document outside the workspace', () => {
    const { pool } = poolOver([APP]);

    try {
      assert.strictEqual(pool.for(documentIn('/elsewhere/index.html.haml')), undefined);
    } finally {
      pool.dispose();
    }
  });

  test('starts and restarts every server', async () => {
    const { pool, created } = poolOver([APP, ENGINE]);

    try {
      await pool.startAll();
      await pool.restartAll();

      assert.deepStrictEqual(
        created.map((server) => [server.starts, server.restarts]),
        [
          [1, 1],
          [1, 1],
        ]
      );
    } finally {
      pool.dispose();
    }
  });

  test('one folder failing to start does not stop the others', async () => {
    const { pool, created } = poolOver([APP, ENGINE]);

    try {
      created[0].start = async () => {
        throw new Error('ruby: not found');
      };

      await pool.startAll();

      assert.strictEqual(created[1].starts, 1);
    } finally {
      pool.dispose();
    }
  });

  test('reports every server running only once they all are', async () => {
    const { pool, created } = poolOver([APP, ENGINE]);

    try {
      assert.strictEqual(pool.allRunning(), false);

      await created[0].start();
      assert.strictEqual(pool.allRunning(), false);

      await created[1].start();
      assert.strictEqual(pool.allRunning(), true);
    } finally {
      pool.dispose();
    }
  });

  test('a folder added later gets a server, started right away', async () => {
    const folders = [APP];
    const { pool, created, emitter } = poolOver(folders);

    try {
      folders.push(ENGINE);
      emitter.fire({ added: [ENGINE], removed: [] });

      assert.strictEqual(created.length, 2);
      assert.strictEqual(created[1].starts, 1);
      assert.strictEqual(pool.for(documentIn('/w/engine/x.haml')) as any, created[1]);
    } finally {
      pool.dispose();
    }
  });

  test('a folder removed takes its server down', () => {
    const folders = [APP, ENGINE];
    const { pool, created, emitter } = poolOver(folders);

    try {
      emitter.fire({ added: [], removed: [ENGINE] });

      assert.strictEqual(created[1].stops, 1);
      assert.deepStrictEqual(pool.all().length, 1);
    } finally {
      pool.dispose();
    }
  });

  test('dispose stops every server', () => {
    const { pool, created } = poolOver([APP, ENGINE]);

    pool.dispose();

    assert.deepStrictEqual(
      created.map((server) => server.stops),
      [1, 1]
    );
    assert.deepStrictEqual(pool.all(), []);
  });
});
