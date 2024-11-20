import { buildHamlTag, jsToHaml } from '../../html2haml/haml';
import { Html2HamlOptions, HamlTabChar } from '../../html2haml';
import { JS_TEMPLATE_INDEX } from './templates';

const options: Html2HamlOptions = {
  tabSize: 2,
  tabChar: HamlTabChar.Space,
};

// describe("buildHamlTag", () => {
//   it("should build HAML tag with attributes and text", () => {
//     const tag = "div";
//     const htmlJs = {
//       div: {
//         attributes: {
//           id: "my-div",
//           class: "container",
//         },
//         "#text": "Hello, world!",
//       },
//     };

//     const expected = ".container#my-div Hello, world!\n";

//     const result = buildHamlTag(tag, tag, htmlJs, 0, options);

//     expect(result).toEqual(expected);
//   });

//   it("should build multi HAML tags with attributes and text", () => {
//     const tag = "div";
//     const htmlJs = {
//       div: {
//         attributes: {
//           class: "container text-center",
//         },
//         div: {
//           attributes: {
//             class: "row",
//           },
//           div: [
//             {
//               attributes: {
//                 class: "col",
//               },
//               "#text": "Column 1",
//             },
//             {
//               attributes: {
//                 class: "col",
//               },
//               "#text": "Column 2",
//             },
//             {
//               attributes: {
//                 class: "col",
//               },
//               "#text": "Column 3",
//             }
//           ],
//         },
//       },
//     };

//     const expected = `.container.text-center
//   .row
//     .col Column 1
//     .col Column 2
//     .col Column 3
// `;

//     const result = buildHamlTag(tag, tag, htmlJs, 0, options);

//     expect(result).toEqual(expected);
//   });
// });

describe('jsToHaml', () => {
  // it("should convert HTML JS object to HAML string", () => {
  //   const htmlJs = {
  //     div: {
  //       attributes: {
  //         id: "myDiv",
  //         class: "container",
  //       },
  //       "#text": "Hello, world!",
  //       p: {},
  //     },
  //   };

  //   const expected = ".container#myDiv\n  Hello, world!\n  %p\n";

  //   const result = jsToHaml(htmlJs, options);

  //   expect(result).toEqual(expected);
  // });

  // it("should return an empty string if the input is not an object", () => {
  //   const htmlJs = "Invalid input";
  //   const expected = "";

  //   const result = jsToHaml(htmlJs, options);

  //   expect(result).toEqual(expected);
  // });

  //   it("should convert a full ERB HTML JS object to HAML string", () => {
  //     const htmlJs = JS_TEMPLATE_INDEX;

  //     const expected = `%h1 Listing Books
  // %table
  //   %thead
  //     %tr
  //       %th Title
  //       %th Content
  //       %th
  //   %tbody
  //     - @books.each do |book|
  //       %tr
  //         %td
  //           = book.title
  //         %td
  //           = book.content
  //         %td
  //           = link_to "Show", book
  //         %td
  //           = link_to "Edit", edit_book_path(book)
  //         %td
  //           = link_to "Destroy", book, data: { turbo_method: :delete, turbo_confirm: "Are you sure?" }
  // %br
  // = link_to "New book", new_book_path
  // `;

  //     const result = jsToHaml(htmlJs, { ...options, erb: true });

  //     expect(result).toEqual(expected);
  //   });

  it('should convert a HTML5 JS object to HAML string', () => {
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

    expect(result).toEqual(expected);
  });
});