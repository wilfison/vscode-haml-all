import { parseErb, setErbTag } from '../../html2haml/erb';
import { ERB_TEMPLATE_INDEX } from './templates';

describe('setErbTag', () => {
  it('should identify ERB tag and replace it with ruby-line content', () => {
    const htmlLine = '<div><%= @message %></div>';
    const match = '<%= @message %>';
    const expected = '<div><ruby-line content="= @message"></div>';

    const result = setErbTag(htmlLine, match);

    expect(result).toEqual(expected);
  });

  it('should identify ERB tag with \'do |\' and replace it with ruby-block content', () => {
    const htmlLine = '<div><% some_method do |arg| %></div>';
    const match = '<% some_method do |arg| %>';
    const expected = '<div><ruby-block content="some_method do |arg|"></div>';

    const result = setErbTag(htmlLine, match);

    expect(result).toEqual(expected);
  });

  it('should identify \'end\' ERB tag and replace it with ruby-block closing tag', () => {
    const htmlLine = '<div><% end %></div>';
    const match = '<% end %>';
    const expected = '<div></ruby-block></div>';

    const result = setErbTag(htmlLine, match);

    expect(result).toEqual(expected);
  });
});

describe('parseErb', () => {
  it('should parse ERB tags in HTML string and replace them with ruby-line and ruby-block', () => {
    const htmlStr = '<div><%= @message %></div>';
    const expected = '<div><ruby-line content="= @message"></div>';

    const result = parseErb(htmlStr);

    expect(result).toEqual(expected);
  });

  it('should parse multiple ERB tags in HTML string and replace them with ruby-line and ruby-block', () => {
    const htmlStr =
      '<div><%= @message %></div><p><% some_method do |arg| %></p>';
    const expected =
      '<div><ruby-line content="= @message"></div><p><ruby-block content="some_method do |arg|"></p>';

    const result = parseErb(htmlStr);

    expect(result).toEqual(expected);
  });

  it('should not modify HTML string if no ERB tags are present', () => {
    const htmlStr = '<div>Hello, world!</div>';
    const expected = '<div>Hello, world!</div>';

    const result = parseErb(htmlStr);

    expect(result).toEqual(expected);
  });

  it('should parse a full ERB template', () => {
    const htmlStr = ERB_TEMPLATE_INDEX;
    const expected = `
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
    <ruby-block content="@books.each do |book|">
      <tr>
        <td><ruby-line content="= book.title"></td>
        <td><ruby-line content="= book.content"></td>
        <td><ruby-line content="= link_to ''Show'', book"></td>
        <td><ruby-line content="= link_to ''Edit'', edit_book_path(book)"></td>
        <td><ruby-line content="= link_to ''Destroy'', book, data: { turbo_method: :delete, turbo_confirm: ''Are you sure?'' }"></td>
      </tr>
    </ruby-block>
  </tbody>
</table>

<br>

<ruby-line content="= link_to ''New book'', new_book_path">
`;

    const result = parseErb(htmlStr);

    expect(result).toEqual(expected);
  });
});
