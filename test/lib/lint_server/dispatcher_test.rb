# frozen_string_literal: true

require "test_helper"

class LintServerDispatcherTest < Minitest::Test
  include LintServerTestHelpers

  def test_dispatch_lint_returns_success_envelope
    response = LintServer::Dispatcher.dispatch(lint_request)

    assert_equal("success", response[:status])
    assert_kind_of(Array, response[:result])
  end

  def test_dispatch_unknown_action_returns_error
    response = LintServer::Dispatcher.dispatch("action" => "nope")

    assert_equal("error", response[:status])
    assert_includes(response[:result], "Unknown action")
  end

  def test_dispatch_captures_handler_errors_instead_of_raising
    # A non-string template makes the handler raise deep inside haml_lint
    # (StringIO.new(Integer) -> TypeError); dispatch must wrap it, not propagate.
    response = LintServer::Dispatcher.dispatch(lint_request(template: 123))

    assert_equal("error", response[:status])
    assert_kind_of(String, response[:result])
  end
end
