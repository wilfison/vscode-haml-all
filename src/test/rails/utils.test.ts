import * as assert from 'assert';

import { Route } from '../../rails/router_parser';
import { buildRouteHelperDetails, buildRouteHelperSnippet } from '../../rails/utils';

suite('rails/utils Tests', () => {
  suite('buildRouteHelperSnippet', () => {
    test('offers a path/url choice and no parentheses for a route without params', () => {
      assert.strictEqual(buildRouteHelperSnippet('users', []).value, 'users_${1|path,url|}');
    });

    test('adds one tab stop per param, numbered after the path/url choice', () => {
      assert.strictEqual(
        buildRouteHelperSnippet('user_post', ['user_id', 'id']).value,
        'user_post_${1|path,url|}(${2:user_id}, ${3:id})$0'
      );
    });
  });

  suite('buildRouteHelperDetails', () => {
    const route: Route = {
      prefix: 'user',
      controller: 'users',
      params: ['id'],
      verbs: new Set(['GET', 'PATCH']),
      actions: new Set(['show', 'update']),
      uri: '/users/:id',
      source_location: '/workspace/config/routes.rb:4',
    };

    test('lists verbs, uri, controller, actions and the source relative to the root', () => {
      assert.strictEqual(
        buildRouteHelperDetails(route, '/workspace'),
        ['GET, PATCH', '/users/:id(.:format)\n', 'Controller: users', 'Actions: show, update', 'Source: /config/routes.rb:4'].join('\n')
      );
    });

    test('omits the source line for a route without a source location (mounted engine)', () => {
      const engine = { ...route, source_location: '' };

      assert.ok(buildRouteHelperDetails(engine, '/workspace').endsWith('Actions: show, update\n'));
    });
  });
});
