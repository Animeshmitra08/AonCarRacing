import ExpoModulesCore
import Darwin

public class LocalNetworkModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LocalNetwork")

    Function("getIPv4Interfaces") { () -> [[String: Any]] in
      return listIPv4Interfaces()
    }

    // iOS routes local-subnet traffic over Wi-Fi/hotspot automatically.
    AsyncFunction("bindToNetworkForAddressAsync") { (_: String) -> Bool in
      return false
    }

    AsyncFunction("unbindNetworkAsync") {}
  }
}

private func listIPv4Interfaces() -> [[String: Any]] {
  var result: [[String: Any]] = []
  var head: UnsafeMutablePointer<ifaddrs>?
  guard getifaddrs(&head) == 0 else { return result }
  defer { freeifaddrs(head) }

  var cursor = head
  while let current = cursor {
    defer { cursor = current.pointee.ifa_next }
    let flags = Int32(bitPattern: current.pointee.ifa_flags)
    guard
      let address = current.pointee.ifa_addr,
      address.pointee.sa_family == UInt8(AF_INET),
      flags & IFF_UP != 0,
      flags & IFF_LOOPBACK == 0
    else { continue }

    var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
    let status = getnameinfo(
      address, socklen_t(address.pointee.sa_len), &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST)
    guard status == 0 else { continue }

    var prefixLength = 0
    if let netmask = current.pointee.ifa_netmask {
      prefixLength = netmask.withMemoryRebound(to: sockaddr_in.self, capacity: 1) {
        $0.pointee.sin_addr.s_addr.nonzeroBitCount
      }
    }

    result.append([
      "name": String(cString: current.pointee.ifa_name),
      "address": host.withUnsafeBufferPointer { String(cString: $0.baseAddress!) },
      "prefixLength": prefixLength,
    ])
  }
  return result
}
