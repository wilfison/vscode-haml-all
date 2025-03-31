# frozen_string_literal: true

# Check if Bundler is being used
if ARGV.include?('--use-bundler')
  require 'bundler/setup'
end

require 'socket'
require 'json'
require 'haml_lint'

require_relative 'lint_server/report'

port = 7654

# Check if the port is already in use
begin
  if `lsof -i :#{port}`.include?('TCP')
    puts "Port #{port} is already in use. Please choose another port."
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
  client = server.accept
  request = {}

  begin
    request = JSON.parse(client.gets)
  rescue JSON::ParserError
    client.puts({ status: 'error', result: 'Invalid JSON' }.to_json)
    client.close
    next
  end

  result = nil

  begin
    result = LintServer::Report.lint(request)
    status = 'success'
  rescue => e
    result = "#{e.message}\n#{e.backtrace.join("\n")}"
    status = 'error'
  end

  response = { status: status, result: result }.to_json
  client.puts response
  client.close
end
