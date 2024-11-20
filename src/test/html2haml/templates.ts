export const ERB_TEMPLATE_INDEX = `
<h1>Listing Books</h1>

<table>
  <thead>
    <tr>
      <th>Title</th>
      <th>Content</th>
      <th colspan="3"></th>
    </tr>
  </thead>

  <tbody>
    <% @books.each do |book| %>
      <tr>
        <td><%= book.title %></td>
        <td><%= book.content %></td>
        <td><%= link_to "Show", book %></td>
        <td><%= link_to "Edit", edit_book_path(book) %></td>
        <td><%= link_to "Destroy", book, data: { turbo_method: :delete, turbo_confirm: "Are you sure?" } %></td>
      </tr>
    <% end %>
  </tbody>
</table>

<br>

<%= link_to "New book", new_book_path %>
`;

export const JS_TEMPLATE_INDEX = {
  h1: {
    "#text": "Listing Books",
  },
  table: {
    thead: {
      tr: {
        th: [
          {
            "#text": "Title",
          },
          {
            "#text": "Content",
          },
          {
            attributes: {
              colspan: "3",
            },
          },
        ],
      },
    },
    tbody: {
      "ruby-block": {
        attributes: {
          content: "@books.each do |book|",
        },
        tr: {
          td: [
            {
              "ruby-line": {
                attributes: {
                  content: "= book.title",
                },
              },
            },
            {
              "ruby-line": {
                attributes: {
                  content: "= book.content",
                },
              },
            },
            {
              "ruby-line": {
                attributes: {
                  content: "= link_to ''Show'', book",
                },
              },
            },
            {
              "ruby-line": {
                attributes: {
                  content: "= link_to ''Edit'', edit_book_path(book)",
                },
              },
            },
            {
              "ruby-line": {
                attributes: {
                  content:
                    "= link_to ''Destroy'', book, data: { turbo_method: :delete, turbo_confirm: ''Are you sure?'' }",
                },
              },
            },
          ],
        },
      },
    },
  },
  br: {
    "#text": "",
  },
  "ruby-line": {
    attributes: {
      content: "= link_to ''New book'', new_book_path",
    },
  },
};