import {
  CompletionItemProvider,
  TextDocument,
  Position,
  Range,
  CompletionItem,
  CompletionItemKind,
  MarkdownString,
  CompletionList
} from 'vscode';

import { HTML_DATA_ATTRIBUTES, RAILS_UJS_DATA_ATTRIBUTES, STIMULUS_DATA_ATTRIBUTES, TURBO_DATA_ATTRIBUTES } from '../data/html_attributes';

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

    // Remove any quoted strings to avoid false matches
    const cleanedCursor = beforeCursor.replace(/(['"]).*?\1/g, '');

    // Check for {} attribute format
    const braceMatch = cleanedCursor.match(/[%#.]?\w*\s*\{[^}]*?(?:,\s*)?(?:["']?)([^"',}:\s]*)\s*$/);
    if (braceMatch) {
      const potentialAttr = braceMatch[1];
      if (potentialAttr.startsWith('data-') || potentialAttr === 'data' || potentialAttr === '') {
        return { isDataAttribute: true, prefix: potentialAttr };
      }
    }

    // Check for () attribute format
    const parenMatch = cleanedCursor.match(/[%#.]?\w*\s*\([^)]*?(?:,\s*)?(?:["']?)([^"',):\s]*)\s*$/);
    if (parenMatch) {
      const potentialAttr = parenMatch[1];
      if (potentialAttr.startsWith('data-') || potentialAttr === 'data' || potentialAttr === '') {
        return { isDataAttribute: true, prefix: potentialAttr };
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
      if (potentialAttr.startsWith('data-') || potentialAttr === 'data' || potentialAttr === '') {
        return { isDataAttribute: true, prefix: potentialAttr };
      }
    }

    return null;
  }

  private getInsertText(attributeName: string, beforeCursor: string): string {
    // Remove any quoted strings to avoid false matches
    const cleanedCursor = beforeCursor.replace(/(['"]).*?\1/g, '');

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
}
