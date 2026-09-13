import * as assert from 'assert';

import { parseRoutes } from '../../rails/router_parser';

// Shape of `bin/rails routes -E`, including what used to throw: stdout noise, a mounted
// engine with no `controller#action`, and a `redirect(...)` route with a blank prefix.
const ROUTES_OUTPUT = `DEPRECATION WARNING: something from an initializer
--[ Route 1 ]-------------------------------------------------------------
Prefix            | users
Verb              | GET
URI               | /users(.:format)
Controller#Action | users#index
Source Location   | config/routes.rb:4
--[ Route 2 ]-------------------------------------------------------------
Prefix            |
Verb              | POST
URI               | /users(.:format)
Controller#Action | users#create
Source Location   | config/routes.rb:4
--[ Route 3 ]-------------------------------------------------------------
Prefix            | user
Verb              | GET
URI               | /users/:id(.:format)
Controller#Action | users#show
Source Location   | config/routes.rb:4
--[ Route 4 ]-------------------------------------------------------------
Prefix            | sidekiq_web
Verb              |
URI               | /sidekiq
Controller#Action | Sidekiq::Web
--[ Route 5 ]-------------------------------------------------------------
Prefix            | legacy
Verb              | GET
URI               | /old(.:format)
Controller#Action | redirect(301, /new)
Source Location   | config/routes.rb:9
`;

suite('rails/router_parser Tests', () => {
  test('parses a realistic routes output without throwing', () => {
    const routes = parseRoutes(ROUTES_OUTPUT);

    assert.deepStrictEqual([...routes.keys()], ['users', 'user', 'sidekiq_web', 'legacy']);
  });

  test('merges verbs and actions sharing a prefix', () => {
    const routes = parseRoutes(ROUTES_OUTPUT);
    const users = routes.get('users');

    assert.ok(users);
    assert.deepStrictEqual([...users.verbs].sort(), ['GET', 'POST']);
    assert.deepStrictEqual([...users.actions].sort(), ['create', 'index']);
  });

  test('extracts uri params', () => {
    const routes = parseRoutes(ROUTES_OUTPUT);

    assert.deepStrictEqual(routes.get('user')?.params, [':id']);
  });

  test('keeps a mounted engine block without a controller#action', () => {
    const routes = parseRoutes(ROUTES_OUTPUT);
    const engine = routes.get('sidekiq_web');

    assert.ok(engine);
    assert.strictEqual(engine.controller, 'Sidekiq::Web');
  });

  test('returns an empty map for output with no route blocks', () => {
    assert.strictEqual(parseRoutes('').size, 0);
    assert.strictEqual(parseRoutes('Could not load the app\n').size, 0);
  });
});
