# frozen_string_literal: true

require "test_helper"

class LintServerCompileTest < Minitest::Test
  def test_compile_renders_html
    html = LintServer::Compile.call("template" => "%h1 Hello\n%p= 1 + 1")

    assert_equal("<h1>Hello</h1>\n<p>2</p>\n", html)
  end

  def test_compile_handles_empty_template
    assert_equal("", LintServer::Compile.call("template" => ""))
  end

  def test_compile_raises_on_invalid_syntax
    # A syntactically invalid template raises SyntaxError (a ScriptError, not a
    # StandardError); the Dispatcher is responsible for turning it into an error
    # response rather than crashing the connection.
    assert_raises(SyntaxError) do
      LintServer::Compile.call("template" => "%p= )bad(")
    end
  end
end
