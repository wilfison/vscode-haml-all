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

  def test_list_cops_reports_the_haml_lint_version
    result = LintServer::Cops.list_cops

    assert_equal(HamlLint::VERSION, result[:version])
  end

  def test_list_cops_reports_native_autocorrect_support
    result = LintServer::Cops.list_cops

    expected = Gem::Version.new(HamlLint::VERSION) >= LintServer::Cops::NATIVE_AUTOCORRECT_VERSION
    assert_equal(expected, result[:supports_native_autocorrect])
  end
end
