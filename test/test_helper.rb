# frozen_string_literal: true

require "bundler/setup"

require "minitest/autorun"
require "minitest/reporters"

require "haml_lint"

Minitest::Reporters.use! Minitest::Reporters::SpecReporter.new

TEST_ROOT_PATH = File.expand_path("..", __dir__)
HAML_LINT_CONFIG_PATH = File.expand_path("support/.haml-lint.yml", __dir__)

$LOAD_PATH.unshift File.expand_path("../lib", __dir__)
