# frozen_string_literal: true

require "test_helper"

class LintServerDispatcherTest < Minitest::Test
  def test_dispatch_lint_returns_success_envelope
    response = LintServer::Dispatcher.dispatch(
      "action" => "lint",
      "template" => "%p Hello",
      "file_path" => "x.haml",
      "config_file" => HAML_LINT_CONFIG_PATH
    )

    assert_equal("success", response[:status])
    assert_kind_of(Array, response[:result])
  end

  def test_dispatch_compile_returns_html
    response = LintServer::Dispatcher.dispatch("action" => "compile", "template" => "%h1 Hi")

    assert_equal("success", response[:status])
    assert_equal("<h1>Hi</h1>\n", response[:result])
  end

  def test_dispatch_unknown_action_returns_error
    response = LintServer::Dispatcher.dispatch("action" => "nope")

    assert_equal("error", response[:status])
    assert_includes(response[:result], "Unknown action")
  end

  def test_dispatch_captures_handler_errors_instead_of_raising
    response = LintServer::Dispatcher.dispatch("action" => "compile", "template" => "%p= )bad syntax(")

    assert_equal("error", response[:status])
    assert_kind_of(String, response[:result])
  end
end
