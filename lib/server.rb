# frozen_string_literal: true

# Load the project's Gemfile when the extension is configured to use Bundler.
require "bundler/setup" if ARGV.include?("--use-bundler")

require "socket"
require "json"
require "stringio"
require "pathname"

# Fail closed when the gem is missing. Installing it here would reach the
# network and write to the user's GEM_HOME without consent, and it would not
# even help under --use-bundler, where a gem outside the bundle is unloadable.
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
  # TCP server that keeps a Ruby process warm so the extension can lint and
  # autocorrect HAML without paying interpreter start-up on every request.
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

      # After the handshake on purpose: the client's start-up budget stays
      # intact. The socket is already bound, so a request arriving now waits in
      # the backlog -- and waits at most for what it would have paid itself.
      prewarm if @prewarm

      accept_loop
    end

    private

    # The extension host owns this process. If it dies without calling deactivate
    # (a crash, `kill -9`), nothing would ever stop us and the port would stay
    # taken for the rest of the session. Our stdin pipe closing is that signal.
    #
    # Only armed for a pipe: on a terminal, stdin never reaches EOF, and the
    # Minitest suite starts the server without asking for the watchdog at all.
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

    # The first request on a project with RuboCop plugins pays seconds of lazy
    # loading: RuboCop registers its cop classes as autoloads and only requires
    # the `plugins:` from .rubocop.yml when it first inspects something. A real
    # round trip over a throwaway template pays that here instead, off the
    # user's path. With no config_file, discovery falls back to Dir.pwd -- the
    # workspace root the extension launched us in, where the project's own
    # .haml-lint.yml and .rubocop.yml live.
    #
    # Reports through stderr, where the boot-time diagnostics already go; both
    # streams reach the "Haml" output channel.
    def prewarm
      started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      request = { "template" => "%p x\n", "file_path" => "__prewarm__.haml" }

      Report.lint(request)
      corrected = Report.autocorrect(request)

      warn "Warmed up in #{((Process.clock_gettime(Process::CLOCK_MONOTONIC) - started) * 1000).round}ms."
      corrected
    rescue StandardError, ScriptError => e
      # A cold cache is a slow first request, not a broken server. ScriptError
      # too, so a plugin that fails to parse cannot take the boot down -- same
      # reasoning as Dispatcher.dispatch.
      warn "Warm-up failed: #{e.message}"
      nil
    end

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

# Refuse to expose an endpoint that can run arbitrary Ruby (through a lint or
# autocorrect config) to every process on the host. The extension always passes
# a per-session token; a manual run has to opt out on purpose.
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
