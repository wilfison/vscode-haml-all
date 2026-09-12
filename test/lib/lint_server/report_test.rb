# frozen_string_literal: true

require "test_helper"
require "tmpdir"

class LintServerReportTest < Minitest::Test
  # config_file is confined to the server's working directory (the workspace
  # root). During the suite that is the repo root, where the fixture lives.
  def test_config_file_inside_workspace_is_honored
    options = LintServer::Report.options_from_request("config_file" => HAML_LINT_CONFIG_PATH)

    assert_equal(File.realpath(HAML_LINT_CONFIG_PATH), options[:config_file])
  end

  def test_config_file_outside_workspace_is_ignored
    Dir.mktmpdir do |dir|
      outside = File.join(dir, ".haml-lint.yml")
      File.write(outside, "linters: {}\n")

      options = LintServer::Report.options_from_request("config_file" => outside)

      assert_nil(options[:config_file], "a config outside the workspace must not be honored")
    end
  end

  def test_missing_config_file_is_ignored
    options = LintServer::Report.options_from_request("config_file" => "/nonexistent/.haml-lint.yml")

    assert_nil(options[:config_file])
  end

  def test_nil_config_file_is_ignored
    options = LintServer::Report.options_from_request({})

    assert_nil(options[:config_file])
  end

  Lint = Struct.new(:line, :severity, :message, :linter, :correctable)
  # A lint from haml_lint < 0.76, which has no #correctable at all.
  LegacyLint = Struct.new(:line, :severity, :message, :linter)
  Linter = Struct.new(:name)

  def test_lint_hash_uses_the_linter_name_when_present
    lint = Lint.new(3, :warning, "boom", Linter.new("RuboCop"))

    assert_equal("RuboCop", LintServer::Report.lint_hash(lint)[:linter_name])
  end

  def test_lint_hash_falls_back_when_linter_is_nil
    # A HAML syntax error yields a lint with no linter; #name must not be called
    # on nil.
    lint = Lint.new(1, :error, "unexpected end", nil)

    hash = LintServer::Report.lint_hash(lint)

    assert_equal("Syntax", hash[:linter_name])
    assert_equal(1, hash[:location][:line])
  end

  def test_lint_hash_propagates_correctable
    linter = Linter.new("TrailingWhitespace")

    assert(LintServer::Report.lint_hash(Lint.new(1, :warning, "x", linter, true))[:correctable])
    refute(LintServer::Report.lint_hash(Lint.new(1, :warning, "x", linter, false))[:correctable])
  end

  def test_lint_hash_correctable_is_nil_when_haml_lint_does_not_expose_it
    lint = LegacyLint.new(1, :warning, "x", Linter.new("TrailingWhitespace"))

    assert_nil(LintServer::Report.lint_hash(lint)[:correctable])
  end
end
