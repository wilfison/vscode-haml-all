# frozen_string_literal: true

# Load the project's Gemfile when the extension is configured to use Bundler.
require "bundler/setup" if ARGV.include?("--use-bundler")

require "socket"
require "json"
require "stringio"
require "pathname"

# Install haml_lint on demand if it is missing, but only once.
haml_lint_installed = false

begin
  require "haml_lint"
rescue LoadError
  raise "haml_lint could not be loaded even after installing it." if haml_lint_installed

  haml_lint_installed = system("gem", "install", "haml_lint")
  raise "Failed to install the haml_lint gem. Check network access and permissions." unless haml_lint_installed

  retry
end

require_relative "lint_server/transport"
require_relative "lint_server/dispatcher"
require_relative "lint_server/controller"
require_relative "lint_server/report"
require_relative "lint_server/cops"
require_relative "lint_server/runner"

module LintServer
  # TCP server that keeps a Ruby process warm so the extension can lint and
  # autocorrect HAML without paying interpreter start-up on every request.
  # Handles one connection at a time, which is plenty for a single editor.
  class Server
    DEFAULT_PORT = 7654
    MAX_PORT_ATTEMPTS = 50

    attr_reader :port

    def initialize(port: DEFAULT_PORT)
      @requested_port = port
    end

    def start
      $stdout.sync = true
      @tcp_server = listen

      notify(status: "success", message: "Server started on port #{port}.", port: port, pid: Process.pid)

      accept_loop
    end

    private

    # Binds to the first free port at or above the requested one. Binding and
    # rescuing EADDRINUSE avoids shelling out to `lsof` (absent on Windows) and
    # closes the race between "is the port free?" and "bind it".
    def listen
      candidate = @requested_port
      attempts = 0

      begin
        server = TCPServer.new("127.0.0.1", candidate)
        @port = candidate
        server
      rescue Errno::EADDRINUSE
        attempts += 1
        raise "No free port found in range #{@requested_port}..#{candidate}" if attempts >= MAX_PORT_ATTEMPTS

        candidate += 1
        retry
      end
    end

    def accept_loop
      loop do
        Controller.call(@tcp_server)
      rescue StandardError => e
        notify(status: "error", message: e.message)
      end
    end

    def notify(status:, message:, **opts)
      puts({ status: status, message: message, **opts }.to_json)
    end
  end
end

LintServer::Server.new.start if ARGV.include?("start")
