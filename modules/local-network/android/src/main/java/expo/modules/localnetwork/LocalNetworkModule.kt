package expo.modules.localnetwork

import android.content.Context
import android.net.ConnectivityManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.Inet4Address
import java.net.InetAddress
import java.net.NetworkInterface

class LocalNetworkModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val connectivityManager: ConnectivityManager
    get() = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

  override fun definition() = ModuleDefinition {
    Name("LocalNetwork")

    // WifiManager only knows about a Wi-Fi network the phone has joined, so it reports
    // 0.0.0.0 while the phone is running a hotspot. NetworkInterface sees every interface.
    Function("getIPv4Interfaces") {
      return@Function listIPv4Interfaces()
    }

    AsyncFunction("bindToNetworkForAddressAsync") { address: String ->
      return@AsyncFunction bindToNetworkFor(address)
    }

    AsyncFunction("unbindNetworkAsync") {
      connectivityManager.bindProcessToNetwork(null)
      return@AsyncFunction Unit
    }
  }

  private fun listIPv4Interfaces(): List<Map<String, Any>> {
    val result = mutableListOf<Map<String, Any>>()
    val interfaces = try {
      NetworkInterface.getNetworkInterfaces()?.toList() ?: emptyList()
    } catch (e: Exception) {
      emptyList()
    }
    for (networkInterface in interfaces) {
      val usable = try {
        networkInterface.isUp && !networkInterface.isLoopback
      } catch (e: Exception) {
        false
      }
      if (!usable) continue
      for (interfaceAddress in networkInterface.interfaceAddresses) {
        val address = interfaceAddress.address
        if (address !is Inet4Address || address.isLoopbackAddress) continue
        val host = address.hostAddress ?: continue
        result.add(
          mapOf(
            "name" to networkInterface.name,
            "address" to host,
            "prefixLength" to interfaceAddress.networkPrefixLength.toInt()
          )
        )
      }
    }
    return result
  }

  private fun bindToNetworkFor(address: String): Boolean {
    val target = try {
      InetAddress.getByName(address) as? Inet4Address
    } catch (e: Exception) {
      null
    } ?: return false

    @Suppress("DEPRECATION")
    for (network in connectivityManager.allNetworks) {
      val properties = connectivityManager.getLinkProperties(network) ?: continue
      for (linkAddress in properties.linkAddresses) {
        val local = linkAddress.address
        if (local is Inet4Address && sameSubnet(local, target, linkAddress.prefixLength)) {
          return connectivityManager.bindProcessToNetwork(network)
        }
      }
    }
    return false
  }

  private fun sameSubnet(a: Inet4Address, b: Inet4Address, prefixLength: Int): Boolean {
    if (prefixLength <= 0 || prefixLength > 32) return false
    val mask = if (prefixLength == 32) -1 else (-1 shl (32 - prefixLength))
    return (toInt(a) and mask) == (toInt(b) and mask)
  }

  private fun toInt(address: Inet4Address): Int =
    address.address.fold(0) { acc, byte -> (acc shl 8) or (byte.toInt() and 0xff) }
}
