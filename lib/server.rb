# frozen_string_literal: true

# Check if Bundler is being used
require "bundler/setup" if ARGV.include?("--use-bundler")

require "socket"
require "json"

begin
  require "haml_lint"
rescue LoadError
  gem install haml_lint
  retry
end

require_relative "lint_server/controller"
require_relative "lint_server/report"
require_relative "lint_server/cops"
require_relative "lint_server/compile"
require_relative "lint_server/runner"

class Server
  attr_accessor :args, :port

  def initialize(args = [])
    @args = args
    @port = 7654
  end

  def start
    check_available_port

    server = TCPServer.new("127.0.0.1", port)
    notify(status: "success", message: "Server started on port #{port}.", opts: { port: port, pid: Process.pid })

    loop_server(server)
  end

  private

  def notify(status:, message:, opts: {})
    puts({
      status: status,
      message: message,
      **opts
    }.to_json)
  end

  def loop_server(server)
    loop do
      LintServer::Controller.call(server)
    rescue StandardError => e
      notify(status: "error", message: e.message)
    end
  end

  def check_available_port
    raise "Port #{port} is already in use. Please choose another port." if `lsof -i :#{port}`.include?("TCP")
  rescue StandardError
    @port += 1
    retry
  end
end

if ARGV.include?("start")
  server = Server.new(ARGV)
  server.start
end
