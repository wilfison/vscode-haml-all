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

  test('should convert a simple ERB content to HAML string', () => {
    const htmlJs = {
      'p': {
        'ruby-line': {
          '#text': '!',
          'attributes': {
            'content': '= @email'
          }
        },
        '#text': 'Hello'
      }
    };

    const expected = `%p
  Hello
  = @email
  !
`;

    const result = jsToHaml(htmlJs, options);

    assert.strictEqual(result, expected);
  });

  test('should convert a ERB block to HAML string', () => {
    const htmlJs = {
      'h2': 'Resend confirmation instructions',
      'ruby-block': {
        'ruby-line': [
          { 'attributes': { 'content': '= f.error_notification' } },
          { 'attributes': { 'content': '= f.full_error :confirmation_token' } }
        ],
        'div': [
          {
            'ruby-line': {
              'attributes': {
                'content': '= f.input :email, required: true, autofocus: true, value: (resource.pending_reconfirmation? ? resource.unconfirmed_email : resource.email), input_html: { autocomplete: \'\'email\'\' }'
              }
            },
            'attributes': {
              'class': 'form-inputs'
            }
          },
          {
            'ruby-line': {
              'attributes': {
                'content': '= f.button :submit, \'\'Resend confirmation instructions\'\''
              }
            },
            'attributes': {
              'class': 'form-actions'
            }
          }
        ],
        'attributes': {
          'content': '= simple_form_for(resource, as: resource_name, url: confirmation_path(resource_name), html: { method: :post }) do |f|'
        }
      },
      'ruby-line': {
        'attributes': {
          'content': '= render \'\'users/shared/links\'\''
        }
      }
    };

    const expected = `%h2
  Resend confirmation instructions
- simple_form_for(resource, as: resource_name, url: confirmation_path(resource_name), html: { method: :post }) do |f|
  = f.error_notification
  = f.full_error :confirmation_token
  .form-inputs
    = f.input :email, required: true, autofocus: true, value: (resource.pending_reconfirmation? ? resource.unconfirmed_email : resource.email), input_html: { autocomplete: ''email'' }
  .form-actions
    = f.button :submit, 'Resend confirmation instructions'
= render 'users/shared/links'
`;

    const result = jsToHaml(htmlJs, options);

    assert.strictEqual(result, expected);
  });
});
