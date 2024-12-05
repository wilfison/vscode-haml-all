require 'haml'

template = STDIN.read
code = Haml::Engine.new({}).call(template)

begin
  puts eval(code)
rescue StandardError => e
  puts "<h3>Error: #{e.message}</h3><p>This only support plain HAML code, no Ruby code allowed.</p>"
end
