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
end
