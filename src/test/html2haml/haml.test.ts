import assert from 'node:assert';

import { jsToHaml } from '../../html2haml/haml';
import { Html2HamlOptions, HamlTabChar } from '../../html2haml/config';

const options: Html2HamlOptions = {
  tabSize: 2,
  tabChar: HamlTabChar.Space,
};

suite('jsToHaml', () => {
  test('should convert a HTML5 JS object to HAML string', () => {
    const htmlJs = {
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
            ],
            title: {
              '#text': 'Html2Haml demo',
            },
          },
          body: {
            h1: {
              '#text': 'Hello, world!',
            },
            div: {
              attributes: {
                class: 'container',
                'data-attr': 'value',
              },
              p: {
                '#text': 'This is a paragraph',
              },
            },
          },
        },
      },
    };

    const expected = `!!! 5
%html{ lang: "en" }
  %head
    %meta{ charset: "utf-8" }
    %title Html2Haml demo
  %body
    %h1 Hello, world!
    .container{ "data-attr": "value" }
      %p This is a paragraph
`;

    const result = jsToHaml(htmlJs, options);

    assert.strictEqual(result, expected);
  });
});