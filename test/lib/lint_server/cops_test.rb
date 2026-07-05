# frozen_string_literal: true

require "test_helper"

class LintServerCopsTest < Minitest::Test
  def test_list_cops_returns_known_cops_only
    result = LintServer::Cops.list_cops

    assert(result.key?(:haml_lint))

    cops = result[:haml_lint]
    refute(cops.key?("error"), "expected cops to load, got: #{cops.inspect}")

    # Only the whitelisted cops should be exposed to the client.
    assert(cops.keys.all? { |name| LintServer::Cops::HAML_LINT_COPS.include?(name) })
    assert_includes(cops.keys, "RuboCop")
  end
end
