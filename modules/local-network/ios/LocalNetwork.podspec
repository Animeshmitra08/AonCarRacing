Pod::Spec.new do |s|
  s.name           = 'LocalNetwork'
  s.version        = '1.0.0'
  s.summary        = 'Lists local IPv4 interfaces for LAN multiplayer.'
  s.description    = 'Lists local IPv4 interfaces (including Personal Hotspot) for LAN multiplayer.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
