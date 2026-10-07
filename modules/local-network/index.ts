import { requireNativeModule } from "expo-modules-core";

export interface IPv4Interface {
  /** OS interface name, e.g. "wlan0", "ap0", "swlan0" (Android) or "en0", "bridge100" (iOS). */
  name: string;
  address: string;
  prefixLength: number;
}

interface LocalNetworkNativeModule {
  /** Every up, non-loopback IPv4 interface, including Wi-Fi hotspot/tethering ones. */
  getIPv4Interfaces(): IPv4Interface[];
  /**
   * Android: routes this app's traffic over the network whose subnet contains `address`
   * (needed when that Wi-Fi has no internet and mobile data is the default).
   * Returns false if no such network exists (e.g. it's this phone's own hotspot). iOS: no-op.
   */
  bindToNetworkForAddressAsync(address: string): Promise<boolean>;
  unbindNetworkAsync(): Promise<void>;
}

export default requireNativeModule<LocalNetworkNativeModule>("LocalNetwork");
