import * as assert from 'assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { getExtensionRoot } from '../utils/extensionRoot';

const root = getExtensionRoot();
const grammar = JSON.parse(fs.readFileSync(path.join(root, 'syntaxes', 'haml.json'), 'utf-8'));
const languageConfig = JSON.parse(fs.readFileSync(path.join(root, 'haml-configuration.json'), 'utf-8'));

// The word under `column`, as VS Code computes it for double-click and Ctrl+D.
function wordAt(line: string, column: number): string | null {
  const pattern = new RegExp(languageConfig.wordPattern, 'g');

  for (const match of line.matchAll(pattern)) {
    if (column >= match.index && column <= match.index + match[0].length) {
      return match[0];
    }
  }

  return null;
}

suite('Language configuration and grammar', () => {
  suite('wordPattern', () => {
    test('keeps a hyphenated attribute, an ivar and a helper name whole', () => {
      assert.strictEqual(wordAt('%div{data-controller: "list"}', 8), 'data-controller');
      assert.strictEqual(wordAt('= render @user', 11), '@user');
      assert.strictEqual(wordAt('= link_to "Home", root_path', 20), 'root_path');
      assert.strictEqual(wordAt('.btn-primary', 4), 'btn-primary');
    });

    test('still breaks on HAML punctuation', () => {
      assert.strictEqual(wordAt('%div{a: 1}', 2), 'div');
      assert.strictEqual(wordAt('%div#id', 2), 'div');
      assert.strictEqual(wordAt('%div#id', 6), 'id');
      assert.strictEqual(wordAt('= "a #{user.name}"', 10), 'user');
    });
  });

  suite('`-# locals:` rule', () => {
    const localsIndex = grammar.patterns.findIndex((rule: any) => rule.name === 'meta.line.ruby.locals.haml');

    test('comes before the comment rules, which would otherwise swallow it', () => {
      const firstComment = grammar.patterns.findIndex((rule: any) => String(rule.name).startsWith('comment.'));

      assert.ok(localsIndex >= 0, 'the locals rule is missing');
      assert.ok(localsIndex < firstComment, `locals rule at ${localsIndex} must precede the comment rule at ${firstComment}`);
    });

    test('matches a strict-locals magic comment and nothing else', () => {
      const begin = new RegExp(grammar.patterns[localsIndex].begin);

      assert.ok(begin.test('-# locals: (user:, title: nil)'));
      assert.ok(begin.test('  -# locals: ()'));
      assert.ok(!begin.test('-# TODO: locals'));
      assert.ok(!begin.test('-#'));
    });

    test('highlights the declaration as Ruby', () => {
      assert.deepStrictEqual(grammar.patterns[localsIndex].patterns, [{ include: 'source.ruby' }]);
    });
  });
});
