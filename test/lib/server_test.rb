# frozen_string_literal: true

require "test_helper"
require "server"

class ServerTest < Minitest::Test
  # Binds a socket to a free port and returns [socket, port]. Keep the socket
  # open to hold the port; close it when done.
  def occupy_free_port
    socket = TCPServer.new("127.0.0.1", 0)
    [socket, socket.addr[1]]
  end

  def test_listen_falls_back_to_next_port_when_requested_is_taken
    holder, taken_port = occupy_free_port
    server = LintServer::Server.new(port: taken_port)

    tcp = server.send(:listen)

    assert_equal(taken_port + 1, server.port)
    assert_equal(taken_port + 1, tcp.addr[1])
  ensure
    tcp&.close
    holder&.close
  end

  def test_listen_uses_requested_port_when_free
    holder, port = occupy_free_port
    holder.close # free it up again

    server = LintServer::Server.new(port: port)
    tcp = server.send(:listen)

    assert_equal(port, server.port)
  ensure
    tcp&.close
  end

  def test_end_to_end_round_trip_over_a_real_socket
    holder, port = occupy_free_port
    holder.close

    thread = Thread.new { silence_stdout { LintServer::Server.new(port: port).start } }
    client = connect_with_retry(port)
    refute_nil(client, "server never started listening on #{port}")

    client.puts({ action: "compile", template: "%h1 Hi" }.to_json)
    response = JSON.parse(client.gets)

    assert_equal("success", response["status"])
    assert_equal("<h1>Hi</h1>\n", response["result"])
  ensure
    client&.close
    thread&.kill
  end

  private

  def connect_with_retry(port, attempts: 40)
    attempts.times do
      return TCPSocket.new("127.0.0.1", port)
    rescue Errno::ECONNREFUSED
      sleep 0.05
    end
    nil
  end

  def silence_stdout
    original = $stdout
    $stdout = StringIO.new
    yield
  ensure
    $stdout = original
  end
end
