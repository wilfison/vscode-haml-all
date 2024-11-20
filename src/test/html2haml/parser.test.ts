import assert from 'node:assert';

import { htmlToJs } from '../../html2haml/parser';
import { ERB_TEMPLATE_INDEX, JS_TEMPLATE_INDEX } from './templates';

suite('htmlToJs', () => {
  test('should parse HTML string to JavaScript object', () => {
    const htmlStr = '<div class=\'container\'><h1>Hello, world!</h1></div>';
    const expected = {
      div: {
        attributes: {
          class: 'container',
        },
        h1: {
          '#text': 'Hello, world!',
        },
      },
    };

    const result = htmlToJs(htmlStr);

    assert.deepStrictEqual(result, expected);
  });

  test('should parse HTML5 base to JavaScript object', () => {
    const html5 = `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Html2Haml demo</title>
      </head>
      <body>
        <h1>Hello, world!</h1>
      </body>
    </html>`;

    const expected = {
      '!doctype': {
        html: {
          attributes: {
            lang: 'en',
          },
          head: {
            meta: [
              {
                attributes: {
                  charset: 'utf-8',
                },
              },
              {
                attributes: {
                  name: 'viewport',
                  content: 'width=device-width, initial-scale=1',
                },
              },
            ],
            title: {
              '#text': 'Html2Haml demo',
            },
          },
          body: {
            h1: {
              '#text': 'Hello, world!',
            },
          },
        },
      },
    };

    const result = htmlToJs(html5);

    assert.deepStrictEqual(result, expected);
  });

  test('should parse ERB inline string to JavaScript object', () => {
    const htmlStr = '<div class=\'container\'><%= @message %></div>';
    const expected = {
      div: {
        attributes: {
          class: 'container',
        },
        'ruby-line': {
          attributes: {
            content: '= @message',
          },
        },
      },
    };

    const result = htmlToJs(htmlStr, { erb: true });

    assert.deepStrictEqual(result, expected);
  });

  test('should parse ERB full template string to JavaScript object', () => {
    const result = htmlToJs(ERB_TEMPLATE_INDEX, { erb: true });

    assert.deepStrictEqual(result, JS_TEMPLATE_INDEX);
  });
});
