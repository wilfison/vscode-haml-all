import {
  CompletionItemProvider,
  TextDocument,
  Position,
  CompletionItem,
  CompletionItemKind,
  MarkdownString,
  CompletionList
} from 'vscode';

import { HTML_DATA_ATTRIBUTES, RAILS_UJS_DATA_ATTRIBUTES, STIMULUS_DATA_ATTRIBUTES, TURBO_DATA_ATTRIBUTES } from '../data/html_attributes';
import { RAILS_HELPERS } from '../data/rails_helpers';

export default class DataAttributeCompletionProvider implements CompletionItemProvider {
  private allDataAttributes = [
    ...HTML_DATA_ATTRIBUTES,
    ...RAILS_UJS_DATA_ATTRIBUTES,
    ...TURBO_DATA_ATTRIBUTES,
    ...STIMULUS_DATA_ATTRIBUTES
  ];

  public provideCompletionItems(
    document: TextDocument,
    position: Position
  ): CompletionList | null {
    const line = document.lineAt(position.line);
    const lineText = line.text;
    const currentChar = position.character;

    // Check if we're in an attribute context in HAML
    // HAML attributes can be in {} or () format
    const beforeCursor = lineText.substring(0, currentChar);

    // Pattern for HAML tag with attributes
    // Examples: %div{data-, %span(data-, .class{data-, #id{data-
    const attributeContext = this.isInAttributeContext(beforeCursor);

    if (!attributeContext) {
      return null;
    }

    const { isDataAttribute, prefix } = attributeContext;

    if (!isDataAttribute) {
      return null;
    }

    // Filter attributes based on prefix
    const filteredAttributes = this.allDataAttributes.filter(attr =>
      attr.name.toLowerCase().startsWith(prefix.toLowerCase())
    );

    const completionItems = filteredAttributes.map(attr => {
      const item = new CompletionItem(attr.name, CompletionItemKind.Property);
      item.detail = 'Data Attribute';
      item.documentation = new MarkdownString(attr.description);

      // Insert the attribute name with appropriate formatting
      // For HAML, we need to handle both {} and () attribute formats
      const insertText = this.getInsertText(attr.name, beforeCursor);
      item.insertText = insertText;

      return item;
    });

    return new CompletionList(completionItems, false);
  }

  private isInAttributeContext(beforeCursor: string): { isDataAttribute: boolean; prefix: string } | null {
    // HAML patterns:
    // %tag{data-  or %tag{ data-  or %tag{attr: 'value', data-
    // %tag(data-  or %tag( data-  or %tag(attr: 'value', data-
    // .class{data-  or #id{data-
    // Rails helpers: link_to "text", path, data_ or form_with model: @model, data_

    // Remove any quoted strings to avoid false matches
    const cleanedCursor = beforeCursor.replace(/(['"]).*?\1/g, '');

    // Check for Rails helpers with data attributes
    // Examples: link_to @foo, data_ | form_with model: @model, data_ | button_to "Delete", path, data_
    const railsHelperMatch = this.checkRailsHelperContext(cleanedCursor);
    if (railsHelperMatch) {
      return railsHelperMatch;
    }

    // Check for {} attribute format
    const braceMatch = cleanedCursor.match(/[%#.]?\w*\s*\{[^}]*?(?:,\s*)?(?:["']?)([^"',}:\s]*)\s*$/);
    if (braceMatch) {
      const potentialAttr = braceMatch[1];
      if (potentialAttr.startsWith('data-') || potentialAttr.startsWith('data_') || potentialAttr === 'data' || potentialAttr === '') {
        return { isDataAttribute: true, prefix: potentialAttr.replace(/_/g, '-') };
      }
    }

    // Check for () attribute format
    const parenMatch = cleanedCursor.match(/[%#.]?\w*\s*\([^)]*?(?:,\s*)?(?:["']?)([^"',):\s]*)\s*$/);
    if (parenMatch) {
      const potentialAttr = parenMatch[1];
      if (potentialAttr.startsWith('data-') || potentialAttr.startsWith('data_') || potentialAttr === 'data' || potentialAttr === '') {
        return { isDataAttribute: true, prefix: potentialAttr.replace(/_/g, '-') };
      }
    }

    // Check for symbol key format (:data- or :data_)
    const symbolMatch = cleanedCursor.match(/:([^,}\)\s:=]*)$/);
    if (symbolMatch) {
      const potentialAttr = symbolMatch[1];
      if (potentialAttr.startsWith('data-') || potentialAttr.startsWith('data_') || potentialAttr === 'data' || potentialAttr === '') {
        return { isDataAttribute: true, prefix: potentialAttr.replace(/_/g, '-') };
      }
    }

    // Check for string key format after quotes
    const stringKeyMatch = cleanedCursor.match(/[{\(][^}\)]*["']([^"']*?)$/);
    if (stringKeyMatch) {
      const potentialAttr = stringKeyMatch[1];
      if (potentialAttr.startsWith('data-') || potentialAttr.startsWith('data_') || potentialAttr === 'data' || potentialAttr === '') {
        return { isDataAttribute: true, prefix: potentialAttr.replace(/_/g, '-') };
      }
    }

    return null;
  }

  private checkRailsHelperContext(cleanedCursor: string): { isDataAttribute: boolean; prefix: string } | null {
    // Create a regex pattern to match Rails helpers with data attributes
    // Examples:
    // = link_to "Text", path, data_
    // = form_with model: @model, data_
    // = button_to "Delete", path, method: :delete, data_
    // = text_field :user, :name, data_
    const helperPattern = new RegExp(
      `(?:^|\\s)(?:=\\s*)?(?:${RAILS_HELPERS.join('|')})\\b.*?(?:,\\s*|\\s+)([^,\\s]*)$`
    );

    const match = cleanedCursor.match(helperPattern);
    if (match) {
      const potentialAttr = match[1];

      // Check if it looks like a data attribute
      if (potentialAttr.startsWith('data_') || potentialAttr.startsWith('data-') || potentialAttr === 'data' || potentialAttr === '') {
        return { isDataAttribute: true, prefix: potentialAttr.replace(/_/g, '-') };
      }

      // Also check for hash-like syntax within helpers
      // = link_to "Text", path, { data_
      const hashInHelperPattern = new RegExp(
        `(?:^|\\s)(?:=\\s*)?(?:${RAILS_HELPERS.join('|')})\\b.*?\\{\\s*([^,}]*)$`
      );
      const hashInHelperMatch = cleanedCursor.match(hashInHelperPattern);
      if (hashInHelperMatch) {
        const hashAttr = hashInHelperMatch[1];
        if (hashAttr.startsWith('data_') || hashAttr.startsWith('data-') || hashAttr === 'data' || hashAttr === '') {
          return { isDataAttribute: true, prefix: hashAttr.replace(/_/g, '-') };
        }
      }
    }

    return null;
  }

  private getInsertText(attributeName: string, beforeCursor: string): string {
    // Remove any quoted strings to avoid false matches
    const cleanedCursor = beforeCursor.replace(/(['"]).*?\1/g, '');

    // Check if we're in a Rails helper context
    const isRailsHelper = this.isInRailsHelperContext(cleanedCursor);
    if (isRailsHelper) {
      // For Rails helpers, use underscore format
      const keyName = attributeName.replace(/-/g, '_');
      return `${keyName}: `;
    }

    // Check if we're in a symbol context (:attr => value)
    if (cleanedCursor.match(/:([^,}\)\s:=]*)$/)) {
      return `${attributeName} => `;
    }

    // Check if we're in a string key context ("attr" => value or 'attr' => value)
    if (cleanedCursor.match(/["'][^"']*$/)) {
      return `${attributeName}`;
    }

    // Check for hash rocket syntax context
    if (cleanedCursor.match(/[{\(][^}\)]*=>\s*['"][^'"]*$/)) {
      return attributeName;
    }

    // Determine the format based on the context
    if (cleanedCursor.includes('{')) {
      // Hash format - check what's already there
      if (cleanedCursor.match(/\{[^}]*:\s*[^,}]*,?\s*$/)) {
        // New hash syntax (Ruby 1.9+): key: value
        const keyName = attributeName.replace(/-/g, '_');
        return `${keyName}: `;
      } else {
        // Old hash syntax: :key => value or "key" => value
        return `${attributeName}: `;
      }
    } else if (cleanedCursor.includes('(')) {
      // Parentheses format: usually symbol keys with hash rockets
      return `${attributeName}: `;
    }

    // Default to new hash syntax
    const keyName = attributeName.replace(/-/g, '_');
    return `${keyName}: `;
  }

  private isInRailsHelperContext(cleanedCursor: string): boolean {
    const helperPattern = new RegExp(`(?:^|\\s)(?:=\\s*)?(?:${RAILS_HELPERS.join('|')})\\b`);
    return helperPattern.test(cleanedCursor);
  }
}
