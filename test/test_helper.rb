# frozen_string_literal: true

require "bundler/setup"

require "minitest/autorun"
require "minitest/reporters"

require "haml_lint"

Minitest::Reporters.use! Minitest::Reporters::SpecReporter.new

TEST_ROOT_PATH = File.expand_path("..", __dir__)
HAML_LINT_CONFIG_PATH = File.expand_path("support/.haml-lint.yml", __dir__)

$LOAD_PATH.unshift File.expand_path("../lib", __dir__)

# Load the server components (mirrors lib/server.rb without the bootstrap that
# picks a port and starts the accept loop).
require "lint_server/transport"
require "lint_server/dispatcher"
require "lint_server/controller"
require "lint_server/report"
require "lint_server/cops"
require "lint_server/compile"
require "lint_server/runner"

# In-memory stand-in for a TCP client socket. Feeds +input+ to #gets and
# captures everything written so tests can assert on the wire response.
class FakeClient
  attr_reader :closed

  def initialize(input = "")
    @input = StringIO.new(input)
    @output = +""
    @closed = false
  end

  def gets
    @input.gets
  end

  def puts(str)
    @output << str.to_s
    @output << "\n" unless str.to_s.end_with?("\n")
  end

  def close
    @closed = true
  end

  # The raw bytes written back to the client.
  def written
    @output
  end

  # The response parsed from the wire (single JSON decode).
  def response
    JSON.parse(@output.strip)
  end
end
