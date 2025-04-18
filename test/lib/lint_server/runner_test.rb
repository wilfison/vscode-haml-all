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

    assert_equal(expected_result, result)
  end
end
