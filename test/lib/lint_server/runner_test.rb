# frozen_string_literal: true

require "test_helper"
require "lint_server/report"
require "lint_server/runner"

class LintServerRunnerTest < Minitest::Test
  def setup
    @runner = LintServer::Runner.new
    @file_base = "#{TEST_ROOT_PATH}/test/support/templates/base.haml"
    @default_options = {
      reporter: LintServer::Report.json_reporter,
      config_file: HAML_LINT_CONFIG_PATH
    }
  end

  def test_runner_initialization
    assert_instance_of(LintServer::Runner, @runner)
  end

  def test_run
    template = [
      "%meta{:foo => 'bar'}",
      "- foo( bar: baz )"
    ].join("\n")

    result = @runner.run(template, @file_base, @default_options)

    assert_instance_of(HamlLint::Report, result)
    assert_instance_of(Array, result.lints)
  end

  def test_run_autocorrect
    template = [
      "%meta{:foo => 'bar'}",
      "- foo( bar: baz )"
    ].join("\n")

    result = @runner.run_autocorrect(template, @file_base, @default_options)
    assert_instance_of(String, result)

    expected_result = [
      "%meta{foo: \"bar\"}",
      "- foo(bar: baz)"
    ].join("\n")

    # Tolerate a trailing newline: newer rubocop/haml_lint versions emit one
    # after autocorrect, which is benign for the corrected output.
    assert_equal(expected_result, result.chomp)
  end

  def test_run_autocorrect_restricted_to_included_linters
    template = [
      "=foo",
      "%meta{:foo => 'bar'}"
    ].join("\n")

    options = @default_options.merge(included_linters: ["SpaceBeforeScript"])
    result = @runner.run_autocorrect(template, @file_base, options)

    # Only SpaceBeforeScript ran: the RuboCop hash-syntax offense is left as is.
    assert_equal("= foo\n%meta{:foo => 'bar'}", result.chomp)
  end

  def test_run_autocorrect_is_safe_only_by_default
    # UnnecessaryStringOutput declares autocorrect_safe(false).
    result = @runner.run_autocorrect("= \"foo\"\n", @file_base, @default_options)

    assert_equal("= \"foo\"", result.chomp)
  end

  def test_run_autocorrect_all_applies_unsafe_corrections
    result = @runner.run_autocorrect("= \"foo\"\n", @file_base, @default_options.merge(autocorrect: :all))

    assert_equal("foo", result.chomp)
  end
end
