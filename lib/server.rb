# frozen_string_literal: true

# Load the project's Gemfile when the extension is configured to use Bundler.
require "bundler/setup" if ARGV.include?("--use-bundler")

require "socket"
require "json"
require "stringio"
require "pathname"

# Fail closed when the gem is missing: installing it here would reach the network
# without consent, and a gem outside the bundle is unloadable under --use-bundler.
begin
  require "haml_lint"
rescue LoadError
  warn "haml_lint gem not found. Install it with: gem install haml_lint " \
       "(or add it to your Gemfile and enable hamlAll.useBundler)."
  exit 1
end

require_relative "lint_server/transport"
require_relative "lint_server/dispatcher"
require_relative "lint_server/controller"
require_relative "lint_server/report"
require_relative "lint_server/cops"
require_relative "lint_server/runner"

module LintServer
  # Keeps a Ruby process warm so linting does not pay interpreter start-up per request.
  # Handles one connection at a time, which is plenty for a single editor.
  class Server
    DEFAULT_PORT = 7654
    MAX_PORT_ATTEMPTS = 50

    attr_reader :port

    def initialize(port: DEFAULT_PORT, watch_stdin: false, prewarm: false)
      @requested_port = port
      @watch_stdin = watch_stdin
      @prewarm = prewarm
    end

    def start
      $stdout.sync = true
      @tcp_server = listen

      start_stdin_watchdog

      notify(status: "success", message: "Server started on port #{port}.", port: port, pid: Process.pid)

      # After the handshake on purpose: the socket is already bound, so a request
      # arriving now waits in the backlog, at most for what it would have paid itself.
      prewarm if @prewarm

      accept_loop
    end

    private

    # stdin reaching EOF means the extension host died without calling deactivate,
    # and nothing else would stop us. Only armed for a pipe: a terminal never EOFs.
    def start_stdin_watchdog
      return nil unless @watch_stdin && stdin_pipe?

      Thread.new do
        $stdin.read
        exit!(0)
      end
    end

    def stdin_pipe?
      $stdin.stat.pipe?
    rescue SystemCallError, IOError
      false
    end

    # RuboCop loads its cop classes and .rubocop.yml `plugins:` only on first inspect,
    # seconds on some projects. A throwaway round trip pays that off the user's path.
    def prewarm
      started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      request = { "template" => "%p x\n", "file_path" => "__prewarm__.haml" }

      Report.lint(request)
      corrected = Report.autocorrect(request)

      warn "Warmed up in #{((Process.clock_gettime(Process::CLOCK_MONOTONIC) - started) * 1000).round}ms."
      corrected
    rescue StandardError, ScriptError => e
      # A cold cache is a slow first request, not a broken server. ScriptError too, so a
      # plugin that fails to parse cannot take the boot down (as in Dispatcher.dispatch).
      warn "Warm-up failed: #{e.message}"
      nil
    end

    # Binds to the first free port at or above the requested one. Rescuing EADDRINUSE
    # avoids `lsof` (absent on Windows) and the "is it free?" / "bind it" race.
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

# A lint config can run arbitrary Ruby, so the endpoint is never exposed unauthenticated.
# The extension always passes a per-session token; a manual run opts out on purpose.
def boot_server
  LintServer::Controller.allow_unauthenticated = ARGV.include?("--no-auth")

  if ENV["HAML_LINT_SERVER_TOKEN"].to_s.empty? && !LintServer::Controller.allow_unauthenticated
    warn "Refusing to start without HAML_LINT_SERVER_TOKEN. " \
         "Pass --no-auth to run unauthenticated (local development only)."
    exit 1
  end

  # Spawned by the extension, so stdin is a pipe whose EOF means the host is gone.
  LintServer::Server.new(watch_stdin: true, prewarm: true).start
end

boot_server if ARGV.include?("start")
