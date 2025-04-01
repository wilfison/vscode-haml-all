# frozen_string_literal: true

# Check if Bundler is being used
if ARGV.include?('--use-bundler')
  require 'bundler/setup'
end

require 'socket'
require 'json'
require 'haml_lint'

require_relative 'lint_server/controller'
require_relative 'lint_server/report'
require_relative 'lint_server/cops'
require_relative 'lint_server/compile'

port = 7654

# Check if the port is already in use
begin
  if `lsof -i :#{port}`.include?('TCP')
    raise "Port #{port} is already in use. Please choose another port."
  end
rescue StandardError
  port += 1
  retry
end

server = TCPServer.new('127.0.0.1', port)
puts(
  {
    status: 'success',
    message: "Server started on port #{port}.",
    port: port,
    pid: Process.pid,
  }.to_json
)

loop do
  begin
    LintServer::Controller.call(server)
  rescue StandardError => e
    puts({ status: 'error', message: e.message }.to_json)
  end
end
