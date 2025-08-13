import * as assert from 'assert';
import * as vscode from 'vscode';
import DataAttributeCompletionProvider from '../../providers/DataAttributeCompletionProvider';

suite('DataAttributeCompletionProvider Tests', () => {
  const provider = new DataAttributeCompletionProvider();

  test('Should provide completion for data- attributes in HAML', async () => {
    const document = await vscode.workspace.openTextDocument({
      content: '%div{data-',
      language: 'haml'
    });

    const position = new vscode.Position(0, 10); // After 'data-'
    const items = provider.provideCompletionItems(document, position);

    assert.notEqual(items, null);
    if (items) {
      const itemsArray = Array.isArray(items) ? items : items.items;
      assert.ok(itemsArray.length > 0);

      // Check if we have common data attributes
      const itemNames = itemsArray.map(item => item.label);
      assert.ok(itemNames.includes('data-confirm'));
      assert.ok(itemNames.includes('data-method'));
      assert.ok(itemNames.includes('data-turbo'));
    }
  });

  test('Should provide completion for data attributes with empty prefix', async () => {
    const document = await vscode.workspace.openTextDocument({
      content: '%div{',
      language: 'haml'
    });

    const position = new vscode.Position(0, 5); // After '{'
    const items = provider.provideCompletionItems(document, position);

    assert.notEqual(items, null);
    if (items) {
      const itemsArray = Array.isArray(items) ? items : items.items;
      assert.ok(itemsArray.length > 0);

      // Check if we have data attributes when no prefix is provided
      const itemNames = itemsArray.map(item => item.label);
      assert.ok(itemNames.some(name => name.startsWith('data-')));
    }
  });

  test('Should provide completion for Rails UJS attributes', async () => {
    const document = await vscode.workspace.openTextDocument({
      content: '%form{data-remote: true, data-',
      language: 'haml'
    });

    const position = new vscode.Position(0, 29); // After 'data-'
    const items = provider.provideCompletionItems(document, position);

    assert.notEqual(items, null);
    if (items) {
      const itemsArray = Array.isArray(items) ? items : items.items;
      const itemNames = itemsArray.map(item => item.label);

      // Check for Rails UJS specific attributes
      assert.ok(itemNames.includes('data-confirm'));
      assert.ok(itemNames.includes('data-method'));
      assert.ok(itemNames.includes('data-disable-with'));
    }
  });

  test('Should provide completion for Turbo Rails attributes', async () => {
    const document = await vscode.workspace.openTextDocument({
      content: '%div{data-turbo-',
      language: 'haml'
    });

    const position = new vscode.Position(0, 15); // After 'data-turbo-'
    const items = provider.provideCompletionItems(document, position);

    assert.notEqual(items, null);
    if (items) {
      const itemsArray = Array.isArray(items) ? items : items.items;
      const itemNames = itemsArray.map(item => item.label);

      // Check for Turbo Rails specific attributes
      assert.ok(itemNames.includes('data-turbo-action'));
      assert.ok(itemNames.includes('data-turbo-cache'));
      assert.ok(itemNames.includes('data-turbo-frame'));
    }
  });

  test('Should work with parentheses attribute syntax', async () => {
    const document = await vscode.workspace.openTextDocument({
      content: '%div(data-',
      language: 'haml'
    });

    const position = new vscode.Position(0, 10); // After 'data-'
    const items = provider.provideCompletionItems(document, position);

    assert.notEqual(items, null);
    if (items) {
      const itemsArray = Array.isArray(items) ? items : items.items;
      assert.ok(itemsArray.length > 0);

      const itemNames = itemsArray.map(item => item.label);
      assert.ok(itemNames.includes('data-confirm'));
    }
  });

  test('Should not provide completion outside attribute context', async () => {
    const document = await vscode.workspace.openTextDocument({
      content: '%div Hello world data-',
      language: 'haml'
    });

    const position = new vscode.Position(0, 20); // After 'data-' in text content
    const items = provider.provideCompletionItems(document, position);

    // Should not provide completion in text content
    assert.equal(items, null);
  });
});
